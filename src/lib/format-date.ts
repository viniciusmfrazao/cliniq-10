/**
 * Formata um campo date do banco (YYYY-MM-DD) sem off-by-one de timezone.
 * Usar sempre que exibir datas vindas de colunas date do Supabase.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}
