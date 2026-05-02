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

const FOLLOWUP_DELAYS_MS: Record<number, number> = {
  // Após qual count, em quanto tempo deve disparar o PRÓXIMO:
  // count=0 (acabou de responder) → próximo em 2h
  // count=1 (mandei #1) → próximo em 24h
  // count=2 (mandei #2) → próximo em 48h
  // count=3 (mandei #3) → não há próximo, marca lost
  0: 2 * 60 * 60 * 1000,
  1: 24 * 60 * 60 * 1000,
  2: 48 * 60 * 60 * 1000,
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
    // agenda o próximo (ou marca lost se já chegou no 3).
    const newCount = ((ctx.lead as any).eva_followup_count ?? 0) + 1;
    if (newCount >= 4) {
      // Esgotou tentativas
      await fetchJson(`${SUPABASE_URL}/rest/v1/leads?id=eq.${ctx.lead.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eva_followup_count: 3,
          eva_next_followup_at: null,
          status: 'lost',
          lost_reason: 'sem_resposta_72h',
        }),
      }).catch(() => {});
      return;
    }
    const delay = FOLLOWUP_DELAYS_MS[newCount] ?? null;
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
  // follow-up pra daqui a 2h. Importante: SÓ agenda se não chegou via cron.
  const delay = FOLLOWUP_DELAYS_MS[0];
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
  if (!ev?.url || !ev?.master_key || !ev?.instance) {
    return { ok: false, error: 'Evolution config ausente em donna_load_context' };
  }
  const url = `${ev.url}/message/sendText/${encodeURIComponent(ev.instance)}`;
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

  // 1) Contexto
  const ctxResp = await loadContext(payload);
  if (!ctxResp.ok || !ctxResp.ctx) return bad(`falha contexto: ${ctxResp.error}`, 500);
  const ctx = ctxResp.ctx;

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
