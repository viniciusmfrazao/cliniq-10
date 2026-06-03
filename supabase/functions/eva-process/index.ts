// ============================================================================
// Edge Function: eva-process
//
// Endpoint chamado pelo Next.js (route /api/webhooks/evolution/[instance])
// quando a flag eva_engine = 'edge'. Faz tudo que o n8n fazia:
//   1. Carrega contexto (RPC donna_load_context)
//   2. Cria lead se for primeira aproximação
//   3. Chama Claude em loop com tools
//   4. Salva turno em eva_conversations
//   5. Envia resposta via Evolution API
//
// Entrada (POST JSON):
//   {
//     clinicId: string,
//     instance: string,
//     phone: string,
//     userText: string,
//     customerName?: string,
//     kind?: 'text'|'image'|'audio'|'video'|'document'|'sticker',
//     mediaUrl?: string|null,
//     messageId?: string|null
//   }
//
// Headers:
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>      (obrigatorio)
//   x-eva-secret:  <eva_internal_secret>                   (opcional extra)
//
// Resposta:
//   { ok, finalText, steps, usage, errors }
// ============================================================================

// deno-lint-ignore-file no-explicit-any

import type { DonnaContext, IncomingPayload, ClaudeMessage } from './types.ts';
import { sanitizeWhatsapp, fetchJson, parseData } from './utils.ts';
import { buildSystemPrompt, TOOLS } from './prompt.ts';
import { runConversation, MODEL_PREMIUM } from './claude.ts';
import type { ConversationStepLog } from './claude.ts';
import { executeToolByName, criarAgendamento } from './tools.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// Debounce: tempo em ms que a Eva espera antes de processar uma msg.
// Se chegar msg nova do paciente nesse intervalo, esta invocacao aborta
// e a proxima (disparada pela msg nova) cuida de responder com tudo no
// contexto. Resolve o problema de paciente que manda em rajada
// ("bom dia" / "tudo bem?" / "queria saber...") e Eva responder cada
// uma separada perdendo o contexto.
//
// 0 = desativado (volta ao comportamento antigo).
// Recomendado: 6000-10000ms (8s default) — nao incomoda na percepcao
// de WhatsApp (paciente nao espera resposta instantanea) e captura
// 95% das rajadas.
const EVA_DEBOUNCE_MS = Number(Deno.env.get('EVA_DEBOUNCE_MS') ?? '15000');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function bad(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

// ─── Validação simples do payload ───────────────────────────────────────────
function validatePayload(input: unknown): { ok: true; payload: IncomingPayload } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'body invalido' };
  const i = input as Record<string, unknown>;
  if (typeof i.clinicId !== 'string' || !i.clinicId) return { ok: false, reason: 'clinicId obrigatorio' };
  if (typeof i.phone !== 'string' || !i.phone) return { ok: false, reason: 'phone obrigatorio' };
  if (typeof i.userText !== 'string' || !i.userText.trim()) return { ok: false, reason: 'userText obrigatorio' };
  return {
    ok: true,
    payload: {
      clinicId: i.clinicId,
      instance: typeof i.instance === 'string' ? i.instance : '',
      phone: i.phone,
      customerName: typeof i.customerName === 'string' ? i.customerName : null,
      userText: String(i.userText).trim(),
      kind: (typeof i.kind === 'string' ? i.kind : 'text') as IncomingPayload['kind'],
      mediaUrl: typeof i.mediaUrl === 'string' ? i.mediaUrl : null,
      messageId: typeof i.messageId === 'string' ? i.messageId : null,
      skipSend: i.skipSend === true,
      isFollowup: i.isFollowup === true,
      followupStage: typeof i.followupStage === 'number' ? i.followupStage : undefined,
    },
  };
}

// Auth: o Supabase já valida o Bearer JWT antes de chegar aqui (verify_jwt=true)
// Qualquer chamada autenticada com anon ou service_role do projeto passa.

// ─── Debounce de mensagens em rajada ───────────────────────────────────────
/**
 * Pacientes mandam "bom dia" → "tudo bem?" → "queria saber sobre botox" em
 * mensagens separadas. Cada uma dispara o webhook que dispara essa função.
 * Sem debounce, Eva responde cada msg isoladamente perdendo contexto.
 *
 * Estratégia:
 *   1. Captura o ID da mensagem que disparou esta invocação.
 *   2. Espera EVA_DEBOUNCE_MS (default 8s).
 *   3. Consulta a última msg do paciente (role='user') no banco.
 *   4. Se a última msg for DIFERENTE da que disparou esta invocação,
 *      significa que chegou msg nova durante a espera. Aborta — a próxima
 *      invocação (disparada pela msg nova) vai responder com tudo.
 *   5. Se for igual, processa normalmente. O history (carregado depois)
 *      já vai ter todas as msgs da rajada porque o webhook insere antes
 *      de chamar a Eva.
 *
 * Não roda debounce em followup (cron-driven, sem msg de paciente).
 *
 * @returns true se DEVE prosseguir, false se DEVE abortar (msg mais nova chegou).
 */
async function debounceWaitAndCheck(payload: IncomingPayload): Promise<{
  proceed: boolean;
  reason?: string;
  useText?: string; // texto mais recente se houver msg nova
}> {
  if (EVA_DEBOUNCE_MS <= 0) return { proceed: true, reason: 'disabled' };
  if (payload.isFollowup) return { proceed: true, reason: 'followup_skip' };
  if (!payload.messageId) return { proceed: true, reason: 'no_message_id' };

  await new Promise((r) => setTimeout(r, EVA_DEBOUNCE_MS));

  const url = new URL(`${SUPABASE_URL}/rest/v1/eva_conversations`);
  url.searchParams.set('clinic_id', `eq.${payload.clinicId}`);
  url.searchParams.set('phone', `eq.${payload.phone}`);
  url.searchParams.set('role', 'eq.user');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '1');
  url.searchParams.set('select', 'id,content,metadata,created_at');

  try {
    const r = await fetch(url.toString(), {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) return { proceed: true, reason: `check_failed_status_${r.status}` };

    const rows = (await r.json()) as Array<{
      id: string;
      content?: string;
      metadata?: { evolution_message_id?: string } | null;
      created_at: string;
    }>;
    const latest = rows?.[0];
    const latestMessageId = latest?.metadata?.evolution_message_id ?? null;

    if (latestMessageId && latestMessageId !== payload.messageId) {
      // Há mensagem mais nova — processar com o conteúdo mais recente
      // em vez de descartar silenciosamente
      const newerText = latest?.content?.trim();
      if (newerText) {
        return { proceed: true, reason: `using_newer_message`, useText: newerText };
      }
      return { proceed: false, reason: `newer_message_no_content_${latestMessageId}` };
    }
    return { proceed: true, reason: 'is_latest' };
  } catch (e) {
    return { proceed: true, reason: `check_error_${(e as Error).message}` };
  }
}

// ─── Carregar contexto via RPC donna_load_context ──────────────────────────
async function loadContext(payload: IncomingPayload): Promise<{ ok: boolean; ctx?: DonnaContext; error?: string }> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/donna_load_context`;
  const r = await fetchJson<DonnaContext>(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_clinic_id: payload.clinicId,
      p_phone: payload.phone,
      p_customer_name: payload.customerName ?? null,
    }),
  });
  if (!r.ok || !r.data) {
    return { ok: false, error: r.error || `status=${r.status}` };
  }
  // Garante shape correto
  const data = r.data as DonnaContext;
  return {
    ok: true,
    ctx: {
      history: Array.isArray(data.history) ? data.history : [],
      professionals: Array.isArray(data.professionals) ? data.professionals : [],
      professional_schedules: Array.isArray(data.professional_schedules) ? data.professional_schedules : [],
      procedures: Array.isArray(data.procedures) ? data.procedures : [],
      clinic: data.clinic ?? { name: 'a clínica', slug: null, settings: {} },
      patient: data.patient ?? null,
      lead: data.lead ?? null,
      evolution: data.evolution ?? null,
      last_assistant_at: data.last_assistant_at ?? null,
    },
  };
}

// ─── Garantir lead (se não tem patient nem lead) ───────────────────────────
async function ensureLead(payload: IncomingPayload, ctx: DonnaContext): Promise<void> {
  if (ctx.patient?.id || ctx.lead?.id) return;
  const url = `${SUPABASE_URL}/rest/v1/leads`;
  const r = await fetchJson<Array<{ id: string; name: string; status: string }>>(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      clinic_id: payload.clinicId,
      name: payload.customerName || 'Lead WhatsApp',
      whatsapp_name: payload.customerName || null, // nome original do WhatsApp
      phone: payload.phone,
      source: 'whatsapp',
      status: 'new',
      whatsapp_chat_id: payload.phone,
      whatsapp_instance: payload.instance?.trim() || null,
      last_whatsapp_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
      whatsapp_opt_in: true,
    }),
  });
  if (r.ok && Array.isArray(r.data) && r.data[0]?.id) {
    ctx.lead = {
      id: r.data[0].id,
      name: r.data[0].name,
      status: r.data[0].status,
      interest: null,
      procedure_id: null,
    };
  }
}

// ─── Follow-up: agenda próximo / cancela / marca lost ─────────────────────

// Defaults caso a clinica nao customize em /dashboard/config
// (count=N significa "ja mandou N follow-ups; em quanto tempo manda o proximo")
const DEFAULT_FOLLOWUP_DELAYS_MS: Record<number, number> = {
  0: 2 * 60 * 60 * 1000,        // 2h
  1: 24 * 60 * 60 * 1000,       // 24h
  2: 48 * 60 * 60 * 1000,       // 48h
  3: 5 * 24 * 60 * 60 * 1000,   // 5 dias
  4: 10 * 24 * 60 * 60 * 1000,  // 10 dias
};

/**
 * Devolve os delays customizados pela clinica (em ms) ou os defaults.
 * Configurado em clinics.settings.eva.followup_minutes (em MINUTOS).
 *   followup_minutes['1'] = minutos antes do estagio 1 (apos count=0)
 *   followup_minutes['2'] = minutos entre estagio 1 e 2
 *   etc.
 */
function resolveFollowupDelays(
  evaCfg: { followup_minutes?: Partial<Record<'1' | '2' | '3' | '4' | '5', number>> | null } | null,
): Record<number, number> {
  const customMinutes = evaCfg?.followup_minutes ?? {};
  const result: Record<number, number> = { ...DEFAULT_FOLLOWUP_DELAYS_MS };
  // count -> chave: count=0 usa key '1' (proximo eh o estagio 1)
  const map: Array<[number, '1' | '2' | '3' | '4' | '5']> = [
    [0, '1'],
    [1, '2'],
    [2, '3'],
    [3, '4'],
    [4, '5'],
  ];
  for (const [count, key] of map) {
    const minutes = customMinutes[key];
    if (typeof minutes === 'number' && minutes > 0) {
      result[count] = minutes * 60 * 1000;
    }
  }
  return result;
}

// Mantido por compatibilidade com codigo abaixo que usa FOLLOWUP_DELAYS_MS
// (sera substituido por resolveFollowupDelays no scope de cada chamada)
const FOLLOWUP_DELAYS_MS: Record<number, number> = {
  0: 2 * 60 * 60 * 1000,
  1: 24 * 60 * 60 * 1000,
  2: 48 * 60 * 60 * 1000,
  3: 5 * 24 * 60 * 60 * 1000,
  4: 10 * 24 * 60 * 60 * 1000,
};

async function scheduleNextFollowup(payload: IncomingPayload, ctx: DonnaContext, opts: {
  appointmentCreated: boolean;
  isFollowupRun: boolean;
}): Promise<void> {
  if (!ctx.lead?.id) return;

  // Se a paciente está convertida (criou agendamento) → cancela follow-up
  if (opts.appointmentCreated) {
    await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eva_followup_count: 0,
        eva_next_followup_at: null,
      }),
    }).catch(() => {});
    return;
  }

  if (opts.isFollowupRun) {
    // Estamos respondendo a um cron de follow-up — incrementa o count e
    // agenda o próximo (ou marca lost se já chegou no 5º estagio).
    const newCount = ((ctx.lead as any).eva_followup_count ?? 0) + 1;
    if (newCount >= 6) {
      // Esgotou tentativas (mandou 5 follow-ups: 2h, 24h, 48h, 5d, 10d)
      await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eva_followup_count: 5,
          eva_next_followup_at: null,
          status: 'lost',
          lost_reason: 'sem_resposta_18d',
        }),
      }).catch(() => {});
      return;
    }
    const delays = resolveFollowupDelays((ctx.clinic.settings as any)?.eva ?? null);
    const delay = delays[newCount] ?? null;
    const next = delay ? new Date(Date.now() + delay).toISOString() : null;
    await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eva_followup_count: newCount,
        eva_next_followup_at: next,
      }),
    }).catch(() => {});
    return;
  }

  // Caso normal: paciente respondeu → reseta contagem e agenda primeiro
  // follow-up pra daqui a 2h (ou o que a clinica configurou).
  const delays = resolveFollowupDelays((ctx.clinic.settings as any)?.eva ?? null);
  const delay = delays[0];
  await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eva_followup_count: 0,
      eva_next_followup_at: new Date(Date.now() + delay).toISOString(),
      last_whatsapp_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

// ─── Marcar lead para revisão humana quando Eva falha silenciosamente ─────
//
// Em caso de erro persistente do Claude (após retries) OU loop esgotado, a
// Eva NÃO envia uma mensagem genérica de erro pro paciente. Em vez disso,
// marca o lead como `needs_human_review` e a equipe responde manual pelo
// painel `/dashboard/whatsapp`. Evita confundir paciente real com "Tive um
// pequeno contratempo aqui" sem contexto.
async function markLeadForHumanReview(
  ctx: DonnaContext,
  reason: 'claude_error' | 'iteration_limit',
  details: string,
): Promise<void> {
  if (!ctx.lead?.id) return;
  const friendlyReason = reason === 'claude_error' ? 'instabilidade' : 'duvida_complexa';
  const isBookingFail = details.includes('confirmou agendamento sem chamar criar_agendamento');
  const friendlyDetails = isBookingFail
    ? `⚠️ AGENDAMENTO NÃO CRIADO: paciente confirmou horário mas o sistema não conseguiu registrar. Confirme manualmente na agenda e avise a paciente. ${details.slice(0, 200)}`
    : reason === 'claude_error'
      ? `Eva ficou instável tecnicamente. Última msg precisa de resposta manual. ${details.slice(0, 200)}`
      : `Eva ficou em loop sem chegar numa resposta. Última msg precisa de resposta manual. ${details.slice(0, 200)}`;
  await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      needs_human_review: true,
      human_review_reason: friendlyReason,
      human_review_details: friendlyDetails,
      human_review_at: new Date().toISOString(),
      // Pausa follow-up automatico — humano cuida agora
      eva_next_followup_at: null,
    }),
  }).catch(() => {});
}

// ─── Salvar turno (user + assistant) em eva_conversations ──────────────────
async function saveTurn(payload: IncomingPayload, ctx: DonnaContext, finalText: string, errors: string[], usage?: unknown, metrics?: {
  tools_used?: string[];
  steps_count?: number;
  booking_recovered?: boolean;
  forced_escalation?: boolean;
}): Promise<void> {
  // Salva como 2 rows separadas (role/content) — modelo atual da tabela
  const url = `${SUPABASE_URL}/rest/v1/eva_conversations`;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const baseMeta = {
    engine: 'edge-function',
    model: 'claude-haiku-4-5-20251001',
    customer_name: payload.customerName ?? null,
    lead_id: ctx.lead?.id ?? null,
    patient_id: ctx.patient?.id ?? null,
    whatsapp_instance: payload.instance?.trim() || null,
    errors: errors.length ? errors : undefined,
    // Observabilidade: persiste o que antes so ia pro log volatil
    tools_used: metrics?.tools_used ?? undefined,
    steps_count: metrics?.steps_count ?? undefined,
    booking_recovered: metrics?.booking_recovered ?? undefined,
    forced_escalation: metrics?.forced_escalation ?? undefined,
  };
  // assistant first (user já foi inserido pelo webhook)
  await fetchJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      clinic_id: payload.clinicId,
      phone: payload.phone,
      role: 'assistant',
      content: finalText,
      customer_name: payload.customerName ?? null,
      lead_id: ctx.lead?.id ?? null,
      patient_id: ctx.patient?.id ?? null,
      last_agent: 'eva',
      metadata: {
        ...baseMeta,
        usage: usage ?? null,
      },
    }),
  });
}

// ─── Enviar resposta via Evolution API ─────────────────────────────────────
async function sendViaEvolution(payload: IncomingPayload, ctx: DonnaContext, text: string): Promise<{ ok: boolean; error?: string }> {
  const ev = ctx.evolution;
  const instanceName =
    (typeof payload.instance === 'string' && payload.instance.trim()) || ev?.instance || '';
  if (!ev?.url || !ev?.master_key || !instanceName) {
    return { ok: false, error: 'Evolution config ausente em donna_load_context' };
  }
  const url = `${ev.url}/message/sendText/${encodeURIComponent(instanceName)}`;
  const r = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ev.master_key,
    },
    body: JSON.stringify({
      number: payload.phone,
      text,
    }),
  });
  if (!r.ok) return { ok: false, error: r.error || `status=${r.status}` };
  return { ok: true };
}

// ─── Pós-processamento: cortar repetição de nome em mensagens consecutivas ──
//
// O Haiku as vezes repete o nome da paciente em toda mensagem (robotico). A
// regra (decisao do cliente): pode repetir, mas NAO em mensagens consecutivas.
// Se a ultima mensagem da Eva ja comecou com o nome, removemos o nome do
// inicio desta. Excecoes (confirmacao de agendamento/D-1/follow-up) sao
// tratadas pelo caller que passa allowName=true.
function stripRepeatedName(
  text: string,
  firstName: string,
  lastAssistantMsg: string | null,
  allowName: boolean,
): string {
  if (allowName || !firstName || firstName.length < 2) return text;
  if (!lastAssistantMsg) return text;

  const nameNorm = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lastNorm = lastAssistantMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // A ultima mensagem da Eva mencionou o nome? (em qualquer posicao das ~6 primeiras palavras)
  const lastMentionedName = lastNorm.split(/\s+/).slice(0, 6).some(w => w.replace(/[^a-z]/g, '') === nameNorm);
  if (!lastMentionedName) return text; // nao repetiu -> deixa como esta

  // Remove o nome no INICIO desta mensagem: "Marcia, qual dia..." -> "Qual dia..."
  const re = new RegExp(`^\\s*${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s,!.:-]+`, 'i');
  let out = text.replace(re, '');
  if (out !== text && out.length > 0) {
    // Capitaliza a primeira letra apos remover o nome
    out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }
  return text;
}

// ─── Pós-processamento: forçar escalonamento se prometeu "vou confirmar" ─────
//
// Se o texto promete retorno ("vou confirmar com a Dra", "te retorno") mas a
// Eva NAO chamou escalar_humano, marcamos o lead pra revisao humana mesmo
// assim — pra equipe de fato dar o retorno prometido. Retorna true se escalou.
function promisedFollowupWithoutEscalating(text: string, toolsUsed: string[]): boolean {
  if (toolsUsed.includes('escalar_humano')) return false;
  return /(vou confirmar|deixa eu confirmar|deixa eu verificar|vou verificar|te retorno|j[aá] passei sua d[uú]vida|vou passar (pra|para) a dra|confirmar com a dra|confirmo com a dra|confirmar isso com)/i.test(text);
}

// ─── Recuperação automática de agendamento ──────────────────────────────────
//
// Chamada pelo loop quando a Eva confirma horario no texto mas nao chamou
// criar_agendamento. Pega o ultimo consultar_agenda (data + slots + profs) e
// o horario que a paciente escolheu (extraido do texto de confirmacao), e
// cria o agendamento direto. Retorna { created } pro loop decidir.
async function recoverBookingFromSteps(
  steps: ConversationStepLog[],
  confirmText: string,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: { supabaseUrl: string; serviceKey: string },
): Promise<{ created: boolean; detail?: string }> {
  // Acha o ultimo consultar_agenda com resultado de horarios reais
  const lastAgenda = [...steps].reverse().find(
    s => s.toolName === 'consultar_agenda' &&
         s.toolResult?.includes('Horarios REAIS disponiveis'),
  );
  if (!lastAgenda?.toolResult) {
    return { created: false, detail: 'sem consultar_agenda previo com horarios' };
  }

  // O input do consultar_agenda tem a data (periodo) e procedimento
  const agendaInput = lastAgenda.toolInput as { periodo?: string; procedimento?: string } | undefined;

  // Extrai os professional_ids e horarios do resultado da tool
  // Formato: "Nome (id: UUID): 09:00, 10:00, 14:00"
  const profLines = lastAgenda.toolResult.split('\n').filter(l => /\(id:\s*[0-9a-f-]+\)/i.test(l));
  if (profLines.length === 0) {
    return { created: false, detail: 'nao consegui parsear profs/horarios da agenda' };
  }

  // Procura no texto de confirmacao um horario HH:MM ou HHh
  const horaMatch = confirmText.match(/\b(\d{1,2})[:h](\d{2})\b/) || confirmText.match(/\b(\d{1,2})\s*h(?:oras)?\b/i);
  let horarioEscolhido: string | null = null;
  if (horaMatch) {
    const hh = String(horaMatch[1]).padStart(2, '0');
    const min = horaMatch[2] ? horaMatch[2] : '00';
    horarioEscolhido = `${hh}:${min}`;
  } else {
    // Sem horario explicito no texto — pega o primeiro horario do primeiro prof
    const firstHora = profLines[0].match(/(\d{2}:\d{2})/);
    if (firstHora) horarioEscolhido = firstHora[1];
  }
  if (!horarioEscolhido) {
    return { created: false, detail: 'nao identifiquei o horario escolhido' };
  }

  // Acha o professional_id do prof que tem esse horario (ou o primeiro)
  let professionalId: string | null = null;
  for (const line of profLines) {
    const idM = line.match(/\(id:\s*([0-9a-f-]+)\)/i);
    if (!idM) continue;
    if (line.includes(horarioEscolhido)) { professionalId = idM[1]; break; }
    if (!professionalId) professionalId = idM[1]; // fallback: primeiro prof
  }
  if (!professionalId) {
    return { created: false, detail: 'nao identifiquei o profissional' };
  }

  // Resolve a data a partir do input do consultar_agenda
  const periodo = agendaInput?.periodo || 'amanha';
  const { dataAlvo } = parseData(periodo);

  const nome = payload.customerName?.trim() || ctx.patient?.name || ctx.lead?.name || 'Paciente';

  const result = await criarAgendamento(
    {
      professional_id: professionalId,
      data: dataAlvo,
      horario: horarioEscolhido,
      nome_paciente: nome,
      procedimento: agendaInput?.procedimento,
    },
    ctx,
    payload,
    env,
  );

  return { created: result.appointmentCreated, detail: result.appointmentCreated ? 'ok' : result.toolResultStr.slice(0, 150) };
}


// ═══════════════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method !== 'POST') return bad('use POST', 405);

  if (!ANTHROPIC_API_KEY) return bad('ANTHROPIC_API_KEY nao configurada', 500);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return bad('SUPABASE_URL/SERVICE_ROLE_KEY nao configurados', 500);

  const t0 = Date.now();
  const errors: string[] = [];
  let body: unknown = null;
  try {
    body = await req.json();
  } catch (_e) {
    return bad('JSON invalido', 400);
  }

  const v = validatePayload(body);
  if (!v.ok) return bad(v.reason, 400);
  const payload = v.payload;

  // LOG DE ENTRADA — visível nos Supabase Edge Function Logs
  console.log(JSON.stringify({
    evt: 'eva_recv',
    clinic: payload.clinicId,
    phone: payload.phone?.slice(-8),  // últimos 8 dígitos por privacidade
    instance: payload.instance,
    is_followup: payload.isFollowup ?? false,
    followup_stage: payload.followupStage ?? null,
    msg_len: typeof payload.message === 'string' ? payload.message.length : 0,
    msg_preview: typeof payload.message === 'string' ? payload.message.slice(0, 60) : null,
  }));

  // 0) Debounce — espera N segundos pra ver se paciente manda mais msgs em rajada.
  //    Se chegar msg nova durante a espera, aborta e deixa a proxima invocacao
  //    (disparada pela msg nova) responder com o contexto completo.
  const debounce = await debounceWaitAndCheck(payload);
  if (!debounce.proceed) {
    return jsonResponse({
      ok: true,
      debounced: true,
      reason: debounce.reason,
      elapsed_ms: Date.now() - t0,
    });
  }

  // 0.5) Verificar se Eva está ativa para essa instância
  //      Se auto_reply_enabled = false, abortar silenciosamente.
  if (!payload.isFollowup && payload.instance) {
    try {
      const waUrl = `${SUPABASE_URL}/rest/v1/clinic_whatsapp?select=auto_reply_enabled&instance_name=eq.${encodeURIComponent(payload.instance)}&limit=1`;
      const waRes = await fetch(waUrl, {
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
      });
      const waData = await waRes.json();
      const autoReply = Array.isArray(waData) && waData.length > 0 ? waData[0].auto_reply_enabled : null;
      if (autoReply === false) {
        console.log(JSON.stringify({ evt: 'eva_blocked', reason: 'auto_reply_disabled', instance: payload.instance, clinic: payload.clinicId }));
        return jsonResponse({ ok: true, skipped: true, reason: 'auto_reply_disabled' });
      }
    } catch (e) {
      // Em caso de erro na verificação, deixa prosseguir (fail-open)
      console.error('Erro ao verificar auto_reply_enabled:', e);
    }
  }

  // 1) Contexto
  const ctxResp = await loadContext(payload);
  if (!ctxResp.ok || !ctxResp.ctx) return bad(`falha contexto: ${ctxResp.error}`, 500);
  let ctx = ctxResp.ctx;
  // Multi-número: donna_load_context devolve instance da linha default — a resposta
  // DEVE sair pelo mesmo instance que recebeu a msg (payload.instance).
  const inboundInstance = typeof payload.instance === 'string' ? payload.instance.trim() : '';
  if (inboundInstance) {
    if (!ctx.evolution) {
      ctx = {
        ...ctx,
        evolution: {
          url: '',
          master_key: '',
          instance: inboundInstance,
          phone: null,
          status: null,
        },
      };
    } else {
      ctx = { ...ctx, evolution: { ...ctx.evolution, instance: inboundInstance } };
    }
  }

  // 2) Cria lead se necessario
  await ensureLead(payload, ctx).catch((e) => errors.push(`ensureLead: ${e?.message ?? e}`));

  // 2.1) Se lead está em 'new' e a pessoa mandou mensagem APÓS a Eva já ter respondido,
  // avança para 'contacted' — indica conversa real iniciada (não só primeiro contato)
  if (!payload.isFollowup && ctx.lead?.id && ctx.lead.status === 'new') {
    const jaRespondeu = ctx.history.some(m => m.role === 'assistant');
    if (jaRespondeu) {
      fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'contacted',
          last_whatsapp_at: new Date().toISOString(),
          last_contact_at: new Date().toISOString(),
        }),
      }).catch(() => {});
      ctx.lead.status = 'contacted';
    }
  }

  // 3) Build prompt + messages
  // historia ja vem em ordem cronologica do RPC (asc). Limita a 20 ultimas
  // pra economizar tokens (cache do system fica bem mais barato).
  const history = ctx.history.slice(-20);

  // ─── CAMADA 1 + 3: detecção de intenção e escalonamento de modelo ────────
  //
  // O Haiku falha em chamar consultar_agenda quando deveria (dado real: 17/17
  // promessas de "vou conferir" sem chamar a tool). A estrategia: detectar que
  // a conversa entrou em territorio de AGENDAMENTO e (a) escalar pro modelo
  // premium SO nesse turno, (b) deixar o loop saber que tool e obrigatoria.
  const lowerUserText = (payload.userText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lowerHistory = history.map(m => (m.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join(' ');

  // Sinais de que a paciente esta falando de HORARIO/AGENDA
  const falaDeHorario = /\b(manha|tarde|noite|hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia \d|dia especifico|que dia|qual dia|que horas|qual horario|horario|agenda|marcar|agendar|disponibilidade|disponivel|vaga|encaixe)\b/.test(lowerUserText);

  // Ja existe um procedimento de interesse na conversa? (pra saber se faz sentido agendar)
  const temProcedimentoNaConversa = ctx.procedures.some(p => {
    const n = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lowerHistory.includes(n) || lowerUserText.includes(n);
  });

  // A Eva ja ofereceu horarios recentemente? (entao a paciente pode estar escolhendo)
  const evaOfereceuHorario = /\d{1,2}:\d{2}|\bhorarios? (disponiveis|abaixo)|qual (desses|horario)/.test(lowerHistory);

  // Momento de agendamento = paciente fala de horario E (tem procedimento OU Eva ja ofereceu)
  const momentoAgendamento = !payload.isFollowup && falaDeHorario && (temProcedimentoNaConversa || evaOfereceuHorario);

  // Escala pro modelo premium SO nesse momento critico (Camada 3 hibrida)
  const modeloParaEsteTurno = momentoAgendamento ? MODEL_PREMIUM : undefined;

  // Detecta se a mensagem atual é sobre PREÇO — se for, não pré-consulta agenda
  // (são intenções diferentes; injetar horários quando ele quer preço confunde o modelo)
  const pedindoPreco = /(preco|precos|valor|quanto custa|quanto fica|qual o valor|investimento|parcela|quanto e|pago|pagamento)/i
    .test(lowerUserText);

  // ─── CAMADA 1.2: pré-consulta forçada da agenda ──────────────────────────
  let preConsultaAgenda: string | null = null;
  if (momentoAgendamento && !evaOfereceuHorario && !pedindoPreco) {
    try {
      let periodo = 'amanha';
      if (/\bhoje\b/.test(lowerUserText)) periodo = 'hoje';
      else if (/\bsegunda\b/.test(lowerUserText)) periodo = 'segunda';
      else if (/\bterca\b/.test(lowerUserText)) periodo = 'terca';
      else if (/\bquarta\b/.test(lowerUserText)) periodo = 'quarta';
      else if (/\bquinta\b/.test(lowerUserText)) periodo = 'quinta';
      else if (/\bsexta\b/.test(lowerUserText)) periodo = 'sexta';
      else if (/\bsabado\b/.test(lowerUserText)) periodo = 'sabado';

      const procMencionado = ctx.procedures.find(p => {
        const n = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return lowerHistory.includes(n) || lowerUserText.includes(n);
      });

      const r = await executeToolByName('consultar_agenda', {
        periodo,
        ...(procMencionado ? { procedimento: procMencionado.name } : {}),
      }, ctx, payload, { supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY });
      preConsultaAgenda = r.resultStr;
    } catch (_e) {
      preConsultaAgenda = null;
    }
  }

  const messages: ClaudeMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Em follow-up, o "user message" é virtual: pedimos pra Eva proativamente
  // gerar a próxima mensagem com base no estágio. Mandamos isso como user
  // turn pra Claude saber o que fazer.
  if (payload.isFollowup) {
    // Follow-up: injeta instrucao de sistema + prefill do assistente.
    // O prefill forca a Eva a comecar a resposta diretamente com o texto
    // da mensagem, sem "pensar em voz alta" antes (bug: raciocinio interno
    // aparecia no WhatsApp do paciente).
    const firstName = (ctx.lead?.name || ctx.patient?.name || '').split(/\s+/)[0] || '';
    messages.push({
      role: 'user',
      content: `[SISTEMA — gere AGORA a mensagem de follow-up do estagio ${payload.followupStage ?? 1}. ` +
        `Escreva SOMENTE o texto final que sera enviado ao WhatsApp — sem explicacoes, sem raciocinio, ` +
        `sem numeracao, sem planos. Comece diretamente com a saudacao ao paciente.]`,
    });
    // Prefill: forca a Eva a comecar com "Oi [Nome]" sem introducao
    if (firstName) {
      messages.push({
        role: 'assistant',
        content: `Oi ${firstName}`,
      });
    }
  } else {
    messages.push({ role: 'user', content: payload.userText });
  }

  // Remove o eco do userText caso ja tenha sido inserido pelo webhook
  // (evita duplicacao no contexto pra Claude)
  while (
    !payload.isFollowup &&
    messages.length >= 2 &&
    messages[messages.length - 1].content === payload.userText &&
    messages[messages.length - 2].role === 'user' &&
    messages[messages.length - 2].content === payload.userText
  ) {
    messages.pop();
  }

  const built = buildSystemPrompt(ctx, payload, history.length);

  // Injeta o contexto dinamico como primeira mensagem do historico
  // Isso permite que o staticPrompt seja cacheado por 1h pela Anthropic
  // enquanto o contexto especifico do turno (nome, data, sinal de preco)
  // entra separado sem invalidar o cache.
  const messagesWithContext: ClaudeMessage[] = [
    { role: 'user', content: built.dynamicPrompt },
    { role: 'assistant', content: 'Entendido. Estou pronta para atender.' },
    ...messages,
  ];

  // CAMADA 1.2: se consultamos a agenda proativamente, injeta os horarios reais
  // como contexto ANTES da ultima fala da paciente. Assim a Eva ja tem os dados
  // na mao e nao precisa (nem pode) prometer "vou conferir" sem entregar.
  if (preConsultaAgenda) {
    // Insere logo apos o dynamicPrompt, antes do historico, pra ficar fresco
    messagesWithContext.splice(2, 0,
      { role: 'user', content: `[SISTEMA - dados de agenda recem-consultados pra esta conversa, use-os pra responder com horarios REAIS agora, NAO prometa "vou conferir":]\n${preConsultaAgenda}` },
      { role: 'assistant', content: 'Recebi os horarios reais. Vou apresenta-los pra paciente agora.' },
    );
  }

  // 4) Loop Claude — captura se houve criar_agendamento bem sucedido
  let appointmentCreated = false;
  let bookingRecovered = false;
  const conv = await runConversation({
    apiKey: ANTHROPIC_API_KEY,
    systemPrompt: built.staticPrompt,
    messages: messagesWithContext,
    tools: TOOLS,
    model: modeloParaEsteTurno,
    useCache: true,
    executeTool: async (name, input) => {
      const r = await executeToolByName(name, input, ctx, payload, {
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
      });
      if (name === 'criar_agendamento' && r.meta?.appointmentCreated === true) {
        appointmentCreated = true;
      }
      return r.resultStr;
    },
    recoverBooking: async (steps, confirmText) => {
      const rec = await recoverBookingFromSteps(steps, confirmText, ctx, payload, {
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
      });
      if (rec.created) {
        appointmentCreated = true;
        bookingRecovered = true;
      }
      return rec;
    },
  });

  errors.push(...conv.errors);

  // ─── Falha silenciosa: Eva não conseguiu responder (Claude erro / loop) ──
  // Em vez de mandar mensagem genérica de erro pro paciente, marca o lead
  // pra revisão humana e devolve sem enviar nada via Evolution.
  if (conv.silentFail) {
    console.log(JSON.stringify({
      evt: 'eva_silent_fail',
      clinic: payload.clinicId,
      phone: payload.phone?.slice(-8),
      reason: conv.silentFailReason,
      errors: conv.errors,
      elapsed_ms: Date.now() - t0,
    }));
    await markLeadForHumanReview(
      ctx,
      conv.silentFailReason ?? 'claude_error',
      conv.errors.join(' | '),
    ).catch((e) => errors.push(`markLeadForHumanReview: ${e?.message ?? e}`));

    const elapsedMs = Date.now() - t0;
    return jsonResponse({
      ok: true,
      silentFail: true,
      reason: conv.silentFailReason,
      sent: false,
      elapsedMs,
      steps: conv.steps,
      usage: conv.totalUsage,
      errors,
    });
  }

  // Se foi follow-up com prefill do assistente, concatenar o prefill ao texto gerado.
  // A API da Anthropic retorna apenas a *continuacao* apos o prefill — o prefill
  // nao vem no content. Precisamos juntar: "Oi [Nome]" + continuacao gerada.
  let rawFinalText = conv.finalText;
  if (payload.isFollowup) {
    const firstName = (ctx.lead?.name || ctx.patient?.name || '').split(/\s+/)[0] || '';
    if (firstName && rawFinalText && !rawFinalText.startsWith('Oi ') && !rawFinalText.startsWith('oi ')) {
      rawFinalText = `Oi ${firstName} ${rawFinalText}`;
    }
  }
  let finalText = sanitizeWhatsapp(rawFinalText)

  let toolsUsed = conv.steps.filter(s => s.toolName).map(s => s.toolName);
  let agendamentoCriado = toolsUsed.includes('criar_agendamento') || appointmentCreated;

  // Variáveis de pós-processamento — declaradas aqui pra estarem disponíveis
  // nas Camadas 1.0 e 1.1 que vêm a seguir
  const consultouAgenda = toolsUsed.includes('consultar_agenda');
  const firstNamePost = String(payload.customerName || ctx.patient?.name || ctx.lead?.name || '').trim().split(/\s+/)[0] || '';

  // ─── CAMADA 1.0: agendamento direto quando paciente escolheu horário ────────
  //
  // Caso real (Eliney): Eva ofereceu 13:30, 14:20, 16:50 → paciente disse "16:50"
  // → Eva respondeu "vou confirmar com a Dra" em vez de criar. A Camada 1.1
  // intercepta a fuga, mas pede pro modelo reapresentar a agenda (errado nesse
  // caso — o horario ja foi escolhido). Esta camada resolve antes: se o texto
  // do usuario e um horario isolado (HH:MM ou "as X horas") E a Eva tinha
  // apresentado horarios recentemente, tenta criar o agendamento direto.
  const horaEscolhidaMatch = (payload.userText || '').match(/^\s*(\d{1,2})[:h](\d{2})\s*$/) ||
    (payload.userText || '').match(/^\s*(\d{1,2})\s*h(?:oras?)?\s*$/i);

  if (!agendamentoCriado && !consultouAgenda && horaEscolhidaMatch && evaOfereceuHorario) {
    try {
      const hh = String(horaEscolhidaMatch[1]).padStart(2, '0');
      const min = horaEscolhidaMatch[2] ? horaEscolhidaMatch[2] : '00';
      const horarioEscolhido = `${hh}:${min}`;

      // recoverBookingFromSteps já tem a logica completa de pegar o prof e data
      const rec = await recoverBookingFromSteps(conv.steps, `confirmado ${horarioEscolhido}`, ctx, payload, {
        supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY,
      });

      if (rec.created) {
        appointmentCreated = true;
        agendamentoCriado = true;
        // Montar confirmação com os dados reais
        const [yy, mm, dd] = (conv.steps.find(s => s.toolName === 'consultar_agenda')?.toolInput as any)?.periodo
          ? ['', '', ''] : ['', '', ''];
        finalText = sanitizeWhatsapp(
          `${firstNamePost ? firstNamePost + ', ' : ''}já deixei seu horário reservado para ${horarioEscolhido}! Qualquer imprevisto, é só me avisar com antecedência. Vai ser um prazer te receber! *`
        );
        conv.errors.push(`[camada1.0] horario escolhido detectado (${horarioEscolhido}) → agendamento criado direto`);
      }
    } catch (_e) {
      // se falhar, segue pro fluxo normal (Camada 1.1 vai tentar)
    }
  }

  // ─── CAMADA 1.1: guard anti-"frase de fuga" sobre agenda ─────────────────
  //
  // Dado real: 17/17 vezes a Eva disse "vou conferir os horarios" e NUNCA
  // chamou consultar_agenda. Aqui interceptamos: se o texto final promete
  // conferir/verificar horarios MAS consultar_agenda nao foi chamada neste
  // turno, nos consultamos a agenda automaticamente e REFAZEMOS a resposta
  // com os horarios reais — a Eva nunca mais promete sem entregar.
  const prometeuConferirAgenda = /\b(vou conferir|deixa eu (conferir|ver|verificar)|em instantes (retorno|volto)|ja (te )?retorno|vou verificar|deixa eu checar|vou checar|conferir os horarios|verificar a (agenda|disponibilidade)|retorno com (as )?opcoes)\b/i
    .test(finalText.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  if (!payload.isFollowup && prometeuConferirAgenda && !consultouAgenda && !agendamentoCriado) {
    try {
      // Detecta periodo/procedimento do que a paciente disse (reusa heuristica)
      let periodo = 'amanha';
      if (/\bhoje\b/.test(lowerUserText)) periodo = 'hoje';
      else if (/\bsegunda\b/.test(lowerUserText)) periodo = 'segunda';
      else if (/\bterca\b/.test(lowerUserText)) periodo = 'terca';
      else if (/\bquarta\b/.test(lowerUserText)) periodo = 'quarta';
      else if (/\bquinta\b/.test(lowerUserText)) periodo = 'quinta';
      else if (/\bsexta\b/.test(lowerUserText)) periodo = 'sexta';
      else if (/\bsabado\b/.test(lowerUserText)) periodo = 'sabado';

      const procMencionado = ctx.procedures.find(p => {
        const n = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return lowerHistory.includes(n) || lowerUserText.includes(n);
      });

      const agendaRes = await executeToolByName('consultar_agenda', {
        periodo,
        ...(procMencionado ? { procedimento: procMencionado.name } : {}),
      }, ctx, payload, { supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY });

      // Refaz a resposta com os horarios reais na mao, forçando modelo premium
      const retryMessages: ClaudeMessage[] = [
        ...messagesWithContext,
        { role: 'assistant', content: finalText },
        { role: 'user', content: `[SISTEMA: voce prometeu conferir os horarios mas nao deve prometer — deve ENTREGAR. Aqui estao os horarios REAIS:\n${agendaRes.resultStr}\n\nResponda a paciente AGORA apresentando 2-3 desses horarios de forma calorosa e natural, em uma unica mensagem de WhatsApp. NAO diga que vai conferir — os dados ja estao acima.]` },
      ];

      const retry = await runConversation({
        apiKey: ANTHROPIC_API_KEY,
        systemPrompt: built.staticPrompt,
        messages: retryMessages,
        tools: TOOLS,
        model: MODEL_PREMIUM,
        useCache: true,
        executeTool: async (name, input) => {
          const r = await executeToolByName(name, input, ctx, payload, {
            supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY,
          });
          if (name === 'criar_agendamento' && r.meta?.appointmentCreated === true) appointmentCreated = true;
          return r.resultStr;
        },
      });

      const retryText = sanitizeWhatsapp(retry.finalText);
      if (retryText && retryText.trim().length > 0) {
        finalText = retryText;
        toolsUsed = [...toolsUsed, 'consultar_agenda', ...retry.steps.filter(s => s.toolName).map(s => s.toolName)];
        agendamentoCriado = toolsUsed.includes('criar_agendamento') || appointmentCreated;
        conv.errors.push('[camada1.1] frase de fuga interceptada — agenda consultada e resposta refeita com horarios reais');
      }
    } catch (e) {
      conv.errors.push(`[camada1.1] falha ao interceptar frase de fuga: ${(e as Error).message}`);
    }
  }

  // ─── PÓS-PROCESSAMENTO 1: cortar repetição de nome em msgs consecutivas ───
  // Excecoes onde o nome PODE repetir: confirmacao de agendamento, follow-up,
  // confirmacao D-1. Nesses casos allowName=true.
  const lastAssistantMsg = [...ctx.history].reverse().find(m => m.role === 'assistant')?.content ?? null;
  const allowName = agendamentoCriado || payload.isFollowup === true;
  finalText = stripRepeatedName(finalText, firstNamePost, lastAssistantMsg, allowName);

  // ─── PÓS-PROCESSAMENTO 2: forçar escalonamento se prometeu retorno ────────
  // Se a Eva prometeu "vou confirmar com a Dra" mas nao chamou escalar_humano,
  // marcamos o lead pra revisao humana mesmo assim — pra equipe dar o retorno.
  let forcedEscalation = false;
  if (!payload.isFollowup && promisedFollowupWithoutEscalating(finalText, toolsUsed)) {
    forcedEscalation = true;
    if (ctx.lead?.id) {
      fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          needs_human_review: true,
          human_review_reason: 'duvida_complexa',
          human_review_details: `Eva prometeu retorno ("vou confirmar") mas nao escalou sozinha. Pergunta da paciente precisa de resposta da equipe. Resposta da Eva: ${finalText.slice(0, 200)}`,
          human_review_at: new Date().toISOString(),
          ai_priority: 'hot',
        }),
      }).catch(() => {});
    }
  }

  console.log(JSON.stringify({
    evt: 'eva_reply',
    clinic: payload.clinicId,
    phone: payload.phone?.slice(-8),
    is_followup: payload.isFollowup ?? false,
    tools_used: toolsUsed,
    booking_recovered: bookingRecovered,
    forced_escalation: forcedEscalation,
    steps_count: conv.steps.length,
    reply_preview: finalText?.slice(0, 80) ?? null,
    reply_len: finalText?.length ?? 0,
    errors: conv.errors.length > 0 ? conv.errors : undefined,
    elapsed_ms: Date.now() - t0,
  }));

  // Proteção: se finalText ficou vazio após sanitize, não salvar nem enviar
  if (!finalText || finalText.trim().length === 0) {
    errors.push('finalText vazio após sanitize — resposta descartada')
    fetchJson(`${SUPABASE_URL}/rest/v1/rpc/insert_eva_log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ p_clinic_id: payload.clinicId, p_phone: payload.phone?.replace(/\D/g,'').slice(-11)??null, p_source: 'eva-process', p_event: 'error', p_status: 'error', p_duration_ms: Date.now()-t0, p_error_message: 'empty_final_text', p_details: { errors } }),
    }).catch(()=>{});
    return jsonResponse({ ok: true, silentFail: true, reason: 'empty_final_text', errors })
  }

  // 5) Salvar resposta (com métricas de observabilidade no metadata)
  await saveTurn(payload, ctx, finalText, conv.errors, conv.totalUsage, {
    tools_used: toolsUsed,
    steps_count: conv.steps.length,
    booking_recovered: bookingRecovered,
    forced_escalation: forcedEscalation,
  }).catch((e) => errors.push(`saveTurn: ${e?.message ?? e}`));

  // 6) Enviar pela Evolution (skipSend pula — útil em smoke tests via SQL)
  const send = payload.skipSend
    ? { ok: true, error: 'skipSend=true' as string | undefined }
    : await sendViaEvolution(payload, ctx, finalText);
  if (!send.ok) errors.push(`sendEvolution: ${send.error}`);

  // 7) Follow-up: agenda/cancela próxima ronda do cron eva-followup
  await scheduleNextFollowup(payload, ctx, {
    appointmentCreated,
    isFollowupRun: payload.isFollowup === true,
  }).catch((e) => errors.push(`scheduleNextFollowup: ${e?.message ?? e}`));

  const elapsedMs = Date.now() - t0;

  // 8) Log na eva_logs — persiste tudo pra o painel de admin ver em tempo real
  const logStatus = errors.length > 0 ? (send.ok ? 'partial' : 'error') : 'ok';
  fetchJson(`${SUPABASE_URL}/rest/v1/rpc/insert_eva_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_clinic_id: payload.clinicId,
      p_phone: payload.phone?.replace(/\D/g, '').slice(-11) ?? null,
      p_source: payload.isFollowup ? 'cron-followup' : 'eva-process',
      p_event: appointmentCreated ? 'booking' : (payload.isFollowup ? 'followup' : 'processed'),
      p_status: logStatus,
      p_details: {
        tools_used: toolsUsed,
        steps_count: conv.steps.length,
        model: modeloParaEsteTurno ?? 'claude-haiku-4-5-20251001',
        tokens: conv.totalUsage,
        booking_recovered: bookingRecovered,
        forced_escalation: forcedEscalation,
        sent: send.ok,
        skip_send: payload.skipSend ?? false,
        reply_len: finalText.length,
        errors: conv.errors.length > 0 ? conv.errors : undefined,
      },
      p_duration_ms: elapsedMs,
      p_error_message: errors.length > 0 ? errors.slice(0, 3).join(' | ') : null,
    }),
  }).catch(() => {}); // fire-and-forget, nunca bloqueia

  return jsonResponse({
    ok: true,
    finalText,
    sent: send.ok,
    elapsedMs,
    steps: conv.steps,
    usage: conv.totalUsage,
    booking_recovered: bookingRecovered,
    errors,
  });
});

