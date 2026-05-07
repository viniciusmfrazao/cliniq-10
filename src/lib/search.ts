/**
 * Helpers para busca de texto via Supabase / PostgREST.
 *
 * O `.or()` e `.ilike()` do PostgREST usam parser próprio com caracteres
 * de controle: `,` (separa cláusulas), `(` `)` (agrupam), `*` (wildcard
 * de star pattern), `%` `_` (wildcards do LIKE), `\` (escape).
 *
 * Se um termo digitado pelo usuário entra direto via interpolação de
 * string, esses caracteres podem:
 *  - quebrar a query (PostgREST devolve 400 e a página fica em branco)
 *  - injetar filtros adicionais (ex: `,clinic_id.neq.xxx`)
 *  - virar DoS por wildcards excessivos (`%%%%%...`)
 *
 * Esta função normaliza o termo: remove caracteres perigosos, colapsa
 * whitespace e limita o tamanho. O resultado é seguro pra concatenar
 * em `.or('col.ilike.%${term}%')`.
 */
export function sanitizeSearchTerm(raw: string | null | undefined, maxLength = 80): string {
  if (!raw) return ''
  const cleaned = raw
    // remove caracteres do parser PostgREST (.or, .ilike pattern, escape)
    .replace(/[,()*\\%_]/g, ' ')
    // remove aspas que poderiam tentar fechar string quoted
    .replace(/["'`]/g, ' ')
    // colapsa espaços múltiplos
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, maxLength)
}
