// Engine genérica de importação de dados de sistemas externos.
// O preset descreve QUAIS colunas podem existir; nada é obrigatório além do mínimo.
// Colunas ausentes simplesmente não alimentam o campo destino.

export type EntityKey =
  | 'patients'
  | 'procedures'
  | 'appointments'
  | 'orcamentos'
  | 'entradas'
  | 'anamneses'

export type TransformId =
  | 'text'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'number'
  | 'cpf'
  | 'gender'
  | 'flag'

export interface FieldMap {
  /** Coluna destino no Clinike */
  target: string
  label: string
  /** Nomes de coluna prováveis na origem, em ordem de preferência */
  candidates: string[]
  transform: TransformId
  required?: boolean
}

export interface SourceFileSpec {
  key: string
  label: string
  /** Substrings do nome do arquivo que identificam este spec */
  matchNames: string[]
  /** Se nenhuma dessas colunas existir, o arquivo não é deste spec */
  signatureColumns: string[]
  feeds: EntityKey[]
  /** Slot ainda não modelado por falta de amostra de dados */
  pending?: boolean
  pendingReason?: string
}

export interface ImportPreset {
  id: string
  label: string
  files: SourceFileSpec[]
  fields: Partial<Record<EntityKey, FieldMap[]>>
  /** Traduções fixas de valores da origem para o vocabulário do Clinike */
  valueMaps: {
    paymentForm: Record<string, string>
    gender: Record<string, string>
  }
}

/** Uma linha crua de planilha */
export type RawRow = Record<string, unknown>

export interface ParsedFile {
  fileName: string
  specKey: string | null
  headers: string[]
  rows: RawRow[]
}

/** Decisão do operador sobre uma entidade que a engine não pode adivinhar */
export interface Reconciliation {
  /** Dentist.id ou nome -> users.id do Clinike ('' = ignorar) */
  professionals: Record<string, string>
  /** nome do procedimento -> 'new' | uuid existente | 'skip' */
  procedures: Record<string, string>
  /** valor bruto da origem -> forma_pagamento do Clinike */
  paymentForms: Record<string, string>
}

export interface ImportOptions {
  clinicId: string
  presetId: string
  /** Sobrescrita manual: entidade -> target -> coluna de origem */
  columnOverrides: Partial<Record<EntityKey, Record<string, string>>>
  reconciliation: Reconciliation
  entities: EntityKey[]
  skipDeleted: boolean
  /** Procedimentos sem preço conhecido entram com este valor */
  defaultProcedurePrice: number
  label?: string
}

export interface EntityStat {
  entity: EntityKey
  read: number
  created: number
  skipped: number
  reasons: Record<string, number>
}
