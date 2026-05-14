// ============================================================================
// Tipos compartilhados pela Edge Function eva-process
// ============================================================================

export type MessageKind = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker';

export interface IncomingPayload {
  clinicId: string;
  instance: string;
  phone: string;
  customerName?: string | null;
  userText: string;
  kind?: MessageKind;
  mediaUrl?: string | null;
  messageId?: string | null;
  /** Se true, processa mas não envia pelo Evolution (smoke test). */
  skipSend?: boolean;
  /** True quando o cron eva-followup chama (Eva inicia o turno). */
  isFollowup?: boolean;
  /** Estágio do follow-up: 1 (após 2h), 2 (após +1d), 3 (após +2d). */
  followupStage?: number;
}

export interface ProfessionalRow {
  id: string;
  name: string;
  role?: string | null;
}

export interface ProcedureRow {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  installments?: number | null;
  installment_price?: number | null;
  professional_ids?: string[] | null;
  duration_minutes?: number | null;
  category?: string | null;
}

export interface EvaConfigSettings {
  /** Texto livre que descreve a personalidade (entra no system prompt) */
  personalidade?: string | null;
  /** Template da mensagem D-1 (regra #6). Pode usar {nome} e {horas} */
  confirmation_d1?: string | null;
  /** Textos dos 5 follow-ups (chaves "1".."5"). Pode usar {nome} */
  followup_texts?: Partial<Record<'1' | '2' | '3' | '4' | '5', string>> | null;
  /** Tempo em minutos antes de cada estagio (chaves "1".."5") */
  followup_minutes?: Partial<Record<'1' | '2' | '3' | '4' | '5', number>> | null;
}

export interface ClinicSettings {
  address?: string | null;
  phone?: string | null;
  hours?: string | null;
  instagram?: string | null;
  parking?: string | null;
  observations?: string | null;
  /** Configuracoes da Eva (personalidade, templates, follow-up) */
  eva?: EvaConfigSettings | null;
  [k: string]: unknown;
}

export interface ClinicRow {
  name: string;
  slug?: string | null;
  settings?: ClinicSettings | null;
}

export interface PatientRow {
  id: string;
  name: string;
  birth_date?: string | null;
}

export interface LeadRow {
  id: string;
  name: string;
  status?: string | null;
  interest?: string | null;
  procedure_id?: string | null;
}

export interface EvolutionConfig {
  url: string;
  master_key: string;
  instance: string;
  phone: string | null;
  status: string | null;
}

export interface ProfessionalScheduleRow {
  professional_id: string;
  professional_name: string;
  day_of_week: number; // 0=dom, 1=seg, ..., 6=sab
  start_time: string;  // "09:00:00"
  end_time: string;    // "18:00:00"
}

export interface DonnaContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  professionals: ProfessionalRow[];
  professional_schedules: ProfessionalScheduleRow[];
  procedures: ProcedureRow[];
  clinic: ClinicRow;
  patient: PatientRow | null;
  lead: LeadRow | null;
  evolution: EvolutionConfig | null;
  /** ISO da última msg do assistente — usado pra detectar conversa fria. */
  last_assistant_at?: string | null;
}

// ─── Claude Messages API ───────────────────────────────────────────────────

export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ClaudeContentBlock[];
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeResponse {
  id: string;
  type: 'message' | 'error';
  role?: 'assistant';
  content?: ClaudeContentBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: { type: string; message: string };
}

// ─── Tool definitions ──────────────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface ToolResult {
  toolUseId: string;
  content: string;
}
