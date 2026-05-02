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

export interface ClinicRow {
  name: string;
  slug?: string | null;
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

export interface DonnaContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  professionals: ProfessionalRow[];
  procedures: ProcedureRow[];
  clinic: ClinicRow;
  patient: PatientRow | null;
  lead: LeadRow | null;
  evolution: EvolutionConfig | null;
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
