// deploy: 2026-05-17-204008
// ============================================================================
// Wrapper da API Anthropic (Messages) com prompt caching + retry com backoff
// Roda em loop até no máximo N iterações, alternando text ↔ tool_use.
// ============================================================================

import type { ClaudeContentBlock, ClaudeMessage, ClaudeResponse, ToolDef } from './types.ts';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 8;

// Retry config — tenta novamente em erros transitorios E em sobrecarga da
// Anthropic (429 rate limit, 529 overload). O custo de um cache-write extra
// e irrelevante perto de perder o lead por uma falha momentanea. So depois
// de 3 tentativas reais e que cai em silentFail.
const RETRY_MAX_ATTEMPTS = 3; // 1 inicial + 2 retries
const RETRY_BASE_MS = 800;
const RETRY_MAX_DELAY_MS = 4000;
// 429 e 529 REINCLUIDOS — sobrecarga momentanea deve ser retentada, nao
// transformada em lead perdido.
const RETRYABLE_STATUS = new Set([0, 408, 429, 500, 502, 503, 504, 529]);

interface CallOpts {
  apiKey: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  tools: ToolDef[];
  /** Quando true, o system prompt é enviado como bloco com cache_control. */
  useCache?: boolean;
}

interface CallResult {
  ok: boolean;
  status: number;
  raw: ClaudeResponse | null;
  error?: string;
  /** Quantas tentativas foram feitas (1 = sucesso de primeira). */
  attempts?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Faz UMA chamada (sem retry) — uso interno do retry loop. */
async function callClaudeOnce(opts: CallOpts): Promise<CallResult> {
  const systemPayload = opts.useCache
    ? [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }]
    : opts.systemPrompt;

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPayload,
    messages: opts.messages,
  };

  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = { type: 'auto', disable_parallel_tool_use: true };
  }

  try {
    const r = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        // Beta header de prompt caching já é stable em sonnet-4-5, mas
        // mantemos o opt-in pra deixar explícito.
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let parsed: ClaudeResponse | null = null;
    try {
      parsed = text ? (JSON.parse(text) as ClaudeResponse) : null;
    } catch {
      // mantém parsed=null
    }

    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        raw: parsed,
        error: parsed?.error?.message ?? text.slice(0, 400),
      };
    }
    return { ok: true, status: r.status, raw: parsed };
  } catch (e) {
    return { ok: false, status: 0, raw: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Wrapper com retry exponencial. Tenta até RETRY_MAX_ATTEMPTS vezes em erros
 * transitórios (rate-limit, overload, network). Em erros 4xx não-retriáveis
 * (400 invalid request, 401 auth) retorna na primeira falha. Cada falha
 * acumula no campo `error` pra debug.
 */
async function callClaude(opts: CallOpts): Promise<CallResult> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    const res = await callClaudeOnce(opts);
    if (res.ok) {
      return { ...res, attempts: attempt };
    }
    errors.push(`#${attempt} status=${res.status}: ${res.error ?? 'sem msg'}`);
    // Erro não-retriável → falha imediato (não adianta tentar de novo)
    if (!RETRYABLE_STATUS.has(res.status)) {
      return { ...res, error: errors.join(' | '), attempts: attempt };
    }
    // Última tentativa? não dorme, retorna erro consolidado
    if (attempt === RETRY_MAX_ATTEMPTS) {
      return { ...res, error: errors.join(' | '), attempts: attempt };
    }
    // Backoff exponencial com cap (1s, 2s, 4s)
    const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS);
    await sleep(delay);
  }
  // Não deveria chegar aqui, mas pra garantir
  return { ok: false, status: 0, raw: null, error: errors.join(' | '), attempts: RETRY_MAX_ATTEMPTS };
}

// ─── Conversation loop ─────────────────────────────────────────────────────

export interface ConversationStepLog {
  iteration: number;
  stop_reason?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RunConvOpts extends CallOpts {
  /** Implementação da tool — recebe nome+input e retorna string. */
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>;
  /**
   * Recuperacao automatica de agendamento. Chamada quando a Eva CONFIRMA um
   * horario no texto mas NAO chamou criar_agendamento. Recebe o historico de
   * tool calls desta conversa (pra achar o ultimo consultar_agenda) e o texto
   * de confirmacao. Deve tentar criar o agendamento e retornar se conseguiu.
   * Se conseguir, o loop usa o texto de confirmacao normalmente. Se nao,
   * cai em silentFail/escalonamento.
   */
  recoverBooking?: (steps: ConversationStepLog[], confirmText: string) => Promise<{ created: boolean; detail?: string }>;
}

export interface RunConvResult {
  finalText: string;
  steps: ConversationStepLog[];
  totalUsage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  errors: string[];
  /**
   * Quando true, a Eva NÃO conseguiu gerar uma resposta confiável
   * (Claude falhou após retries, ou loop estourou MAX iterações).
   * O caller deve:
   *   - NÃO enviar `finalText` pro paciente (mensagem fallback é generica)
   *   - Marcar o lead como `needs_human_review` com razão `instabilidade`
   *   - Logar o motivo via `errors` pra debug
   */
  silentFail?: boolean;
  /** Razão do silentFail, pra UI mostrar pra equipe humana. */
  silentFailReason?: 'claude_error' | 'iteration_limit';
}

/**
 * Executa o loop conversacional: chama Claude, executa tool quando pedido,
 * repete até receber `stop_reason: end_turn`. Limita a MAX_TOOL_ITERATIONS.
 */
export async function runConversation(opts: RunConvOpts): Promise<RunConvResult> {
  const steps: ConversationStepLog[] = [];
  const errors: string[] = [];
  const totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

  // messages é mutado a cada iteração (acumula tool_use + tool_result)
  const messages: ClaudeMessage[] = [...opts.messages];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const callRes = await callClaude({
      apiKey: opts.apiKey,
      systemPrompt: opts.systemPrompt,
      messages,
      tools: opts.tools,
      useCache: opts.useCache,
    });

    if (!callRes.ok || !callRes.raw) {
      errors.push(
        `[claude-call#${i}] status=${callRes.status} attempts=${callRes.attempts ?? 1}: ${
          callRes.error ?? 'sem resposta'
        }`,
      );
      steps.push({ iteration: i, stop_reason: 'error' });
      // Fallback mudo: NÃO enviamos resposta pro paciente. O caller (index.ts)
      // marca o lead pra revisão humana. Evita o eco "Tive um pequeno contratempo
      // aqui" que confunde paciente real e mantém a Eva profissional sob falha.
      return {
        finalText: '',
        steps,
        totalUsage,
        errors,
        silentFail: true,
        silentFailReason: 'claude_error',
      };
    }

    const r = callRes.raw;
    if (r.usage) {
      totalUsage.input_tokens += r.usage.input_tokens || 0;
      totalUsage.output_tokens += r.usage.output_tokens || 0;
      totalUsage.cache_read_input_tokens += r.usage.cache_read_input_tokens || 0;
      totalUsage.cache_creation_input_tokens += r.usage.cache_creation_input_tokens || 0;
    }

    const content: ClaudeContentBlock[] = r.content || [];
    const toolUse = content.find((b) => b.type === 'tool_use');
    const textBlock = content.find((b) => b.type === 'text');

    const stepLog: ConversationStepLog = {
      iteration: i,
      stop_reason: r.stop_reason,
      cacheReadTokens: r.usage?.cache_read_input_tokens,
      cacheCreationTokens: r.usage?.cache_creation_input_tokens,
      inputTokens: r.usage?.input_tokens,
      outputTokens: r.usage?.output_tokens,
    };

    // Sem tool_use → resposta final
    if (r.stop_reason !== 'tool_use' || !toolUse) {
      steps.push(stepLog);

      // Log para debug — captura stop_reason inesperado sem tool call
      if (r.stop_reason !== 'end_turn' && r.stop_reason !== 'max_tokens') {
        errors.push(`[iter#${i}] stop_reason inesperado: ${r.stop_reason}`);
      }

      // Extrair texto
      const text = textBlock?.text?.trim() ||
        content.filter(b => b.type === 'text').map(b => b.text || '').join(' ').trim();

      if (!text) {
        // Output vazio apos tool. Em vez de empurrar uma instrucao generica
        // (que gera mensagem duplicada/desconexa), tratamos de forma inteligente:
        const lastToolStep = [...steps].reverse().find(s => s.toolName);

        // Se a ultima tool foi criar_agendamento com sucesso, montamos a
        // confirmacao a partir dos dados da tool — nao dependemos do modelo.
        if (lastToolStep?.toolName === 'criar_agendamento' &&
            lastToolStep.toolResult?.includes('AGENDAMENTO CRIADO COM SUCESSO')) {
          const ti = lastToolStep.toolInput as Record<string, unknown> | undefined;
          const nome = String(ti?.nome_paciente ?? '').split(/\s+/)[0] || '';
          const data = String(ti?.data ?? '');
          const hora = String(ti?.horario ?? '');
          const [yy, mm, dd] = data.split('-');
          const dataFmt = dd && mm && yy ? `${dd}/${mm}/${yy}` : data;
          const recovered = `${nome ? nome + ', ' : ''}já deixei seu horário reservado para ${dataFmt} às ${hora}. Qualquer imprevisto, é só me avisar com antecedência. Vai ser um prazer te receber! *`;
          errors.push(`[iter#${i}] output vazio apos criar_agendamento — confirmacao reconstruida dos dados da tool`);
          return { finalText: recovered, steps, totalUsage, errors };
        }

        // Caso geral: uma unica re-tentativa controlada pedindo so o texto.
        // Se ja tentamos isso antes nesta conversa, paramos pra nao duplicar.
        const jaForcou = errors.some(e => e.includes('output vazio'));
        if (!jaForcou) {
          errors.push(`[iter#${i}] output vazio -- pedindo texto de fechamento (1x)`);
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: 'Responda a paciente agora em uma unica mensagem curta de WhatsApp, em texto corrido. Nao chame nenhuma tool.' });
          continue;
        }

        // Ja forcou uma vez e continua vazio — escala em vez de insistir.
        errors.push(`[iter#${i}] output vazio persistente apos re-tentativa`);
        return { finalText: '', steps, totalUsage, errors, silentFail: true, silentFailReason: 'claude_error' };
      }

      // Detecta se o texto confirma agendamento sem a tool ter sido chamada
      const toolsCalledSoFar = steps.filter(s => s.toolName).map(s => s.toolName);
      const agendamentoCriado = toolsCalledSoFar.includes('criar_agendamento');
      const confirmouNoTexto =
        /(j[aá] deixei|horario reservado|horário reservado|agendamento confirmado|horario marcado|horário marcado|deixei seu hor)/i.test(text);

      if (!agendamentoCriado && confirmouNoTexto) {
        // RECUPERACAO AUTOMATICA (decisao do cliente): em vez de descartar e
        // mandar pra humano, tentamos criar o agendamento sozinhos a partir do
        // ultimo consultar_agenda + horario que a paciente escolheu.
        if (opts.recoverBooking) {
          const rec = await opts.recoverBooking(steps, text);
          if (rec.created) {
            errors.push(`[iter#${i}] agendamento recuperado automaticamente (Eva confirmou no texto sem chamar a tool)`);
            return { finalText: text, steps, totalUsage, errors };
          }
          errors.push(`[iter#${i}] recuperacao de agendamento falhou: ${rec.detail ?? 'sem detalhe'}`);
        }
        // Nao conseguiu recuperar — aí sim escala (slot ocupado, dados faltando)
        errors.push(`[iter#${i}] Eva confirmou agendamento sem criar_agendamento e recuperacao falhou — escalando`);
        return {
          finalText: '',
          steps,
          totalUsage,
          errors,
          silentFail: true,
          silentFailReason: 'claude_error',
        };
      }

      return {
        finalText: text,
        steps,
        totalUsage,
        errors,
      };
    }

    // Executa a tool
    stepLog.toolName = toolUse.name;
    stepLog.toolInput = toolUse.input as Record<string, unknown>;
    let toolResultStr: string;
    try {
      toolResultStr = await opts.executeTool(toolUse.name!, toolUse.input as Record<string, unknown>);
    } catch (e) {
      toolResultStr = `Erro interno na tool ${toolUse.name}: ${e instanceof Error ? e.message : String(e)}. Peca desculpas com elegancia.`;
      errors.push(`[tool#${i} ${toolUse.name}] ${toolResultStr.slice(0, 200)}`);
    }
    stepLog.toolResult = toolResultStr;
    steps.push(stepLog);

    // Empilha o turno do assistente (com tool_use) + nosso tool_result, e continua.
    // Se houver tools paralelas (não deveria com disable_parallel_tool_use), garante
    // que TODAS levem tool_result.
    const allToolUses = content.filter((b) => b.type === 'tool_use');
    const toolResults: ClaudeContentBlock[] = allToolUses.map((tu) => ({
      type: 'tool_result',
      tool_use_id: tu.id!,
      content: tu.id === toolUse.id
        ? toolResultStr
        : 'Tool secundaria nao executada nesta passada. Use o resultado da tool principal acima.',
    }));

    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: toolResults });
  }

  errors.push(`Loop esgotou ${MAX_TOOL_ITERATIONS} iteracoes`);
  // Loop infinito (Claude pediu tools sem parar) também conta como falha
  // silenciosa — escala pra humano em vez de mandar fallback generico.
  return {
    finalText: '',
    steps,
    totalUsage,
    errors,
    silentFail: true,
    silentFailReason: 'iteration_limit',
  };
}
// staging deploy Sat May 16 18:53:05 UTC 2026
// deploy: 2026-05-17-204008
