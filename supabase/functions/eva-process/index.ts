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
import { sanitizeWhatsapp, fetchJson } from './utils.ts';
import { buildSystemPrompt, TOOLS } from './prompt.ts';
import { runConversation } from './claude.ts';
import { executeToolByName } from './tools.ts';

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
const EVA_DEBOUNCE_MS = Number(Deno.env.get('EVA_DEBOUNCE_MS') ?? '8000');

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
}> {
  if (EVA_DEBOUNCE_MS <= 0) return { proceed: true, reason: 'disabled' };
  if (payload.isFollowup) return { proceed: true, reason: 'followup_skip' };
  if (!payload.messageId) return { proceed: true, reason: 'no_message_id' };

  await new Promise((r) => setTimeout(r, EVA_DEBOUNCE_MS));

  // Busca a última mensagem do paciente após a espera.
  // Filtramos por role=user e ordenamos por created_at desc (com fallback no
  // próprio metadata->>evolution_message_id que o webhook salva).
  const url = new URL(`${SUPABASE_URL}/rest/v1/eva_conversations`);
  url.searchParams.set('clinic_id', `eq.${payload.clinicId}`);
  url.searchParams.set('phone', `eq.${payload.phone}`);
  url.searchParams.set('role', 'eq.user');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '1');
  url.searchParams.set('select', 'id,metadata,created_at');

  try {
    const r = await fetch(url.toString(), {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    if (!r.ok) {
      // Se a verificação falhar, prossegue (modo seguro: pelo menos responde).
      return { proceed: true, reason: `check_failed_status_${r.status}` };
    }
    const rows = (await r.json()) as Array<{
      id: string;
      metadata?: { evolution_message_id?: string } | null;
      created_at: string;
    }>;
    const latest = rows?.[0];
    const latestMessageId = latest?.metadata?.evolution_message_id ?? null;

    if (latestMessageId && latestMessageId !== payload.messageId) {
      return { proceed: false, reason: `newer_message_${latestMessageId}` };
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
  const friendlyDetails =
    reason === 'claude_error'
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
async function saveTurn(payload: IncomingPayload, ctx: DonnaContext, finalText: string, errors: string[]): Promise<void> {
  // Salva como 2 rows separadas (role/content) — modelo atual da tabela
  const url = `${SUPABASE_URL}/rest/v1/eva_conversations`;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const baseMeta = {
    engine: 'edge-function',
    customer_name: payload.customerName ?? null,
    lead_id: ctx.lead?.id ?? null,
    patient_id: ctx.patient?.id ?? null,
    whatsapp_instance: payload.instance?.trim() || null,
    errors: errors.length ? errors : undefined,
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
      metadata: baseMeta,
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

  // 2) Cria lead se necessario (paralelo ao restante seria ideal, mas precisamos dele em saveTurn)
  await ensureLead(payload, ctx).catch((e) => errors.push(`ensureLead: ${e?.message ?? e}`));

  // 3) Build prompt + messages
  // historia ja vem em ordem cronologica do RPC (asc). Limita a 20 ultimas
  // pra economizar tokens (cache do system fica bem mais barato).
  const history = ctx.history.slice(-20);
  const messages: ClaudeMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Em follow-up, o "user message" é virtual: pedimos pra Eva proativamente
  // gerar a próxima mensagem com base no estágio. Mandamos isso como user
  // turn pra Claude saber o que fazer.
  if (payload.isFollowup) {
    messages.push({
      role: 'user',
      content: '[SISTEMA — não responda essa frase: gere agora a mensagem de follow-up apropriada pro estágio descrito no system prompt. Curta, calorosa, sem repetir o que já foi dito.]',
    });
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

  // 4) Loop Claude — captura se houve criar_agendamento bem sucedido
  let appointmentCreated = false;
  const conv = await runConversation({
    apiKey: ANTHROPIC_API_KEY,
    systemPrompt: built.systemPrompt,
    messages,
    tools: TOOLS,
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
  });

  errors.push(...conv.errors);

  // ─── Falha silenciosa: Eva não conseguiu responder (Claude erro / loop) ──
  // Em vez de mandar mensagem genérica de erro pro paciente, marca o lead
  // pra revisão humana e devolve sem enviar nada via Evolution.
  if (conv.silentFail) {
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

  const finalText = sanitizeWhatsapp(conv.finalText);

  // 5) Salvar resposta
  await saveTurn(payload, ctx, finalText, conv.errors).catch((e) => errors.push(`saveTurn: ${e?.message ?? e}`));

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

  return jsonResponse({
    ok: true,
    finalText,
    sent: send.ok,
    elapsedMs,
    steps: conv.steps,
    usage: conv.totalUsage,
    errors,
  });
});
