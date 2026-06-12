/**
 * parseSupabaseError
 * Converte mensagens técnicas do Supabase/banco em mensagens amigáveis em português.
 * Use em todos os lugares que exibem erros ao usuário.
 */
export function parseSupabaseError(error: unknown): string {
  const msg = (
    (error as { message?: string })?.message ||
    (error as { error_description?: string })?.error_description ||
    String(error)
  ).toLowerCase()

  // Duplicidade
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('phone') || msg.includes('whatsapp') || msg.includes('telefone'))
      return 'Este WhatsApp já está cadastrado para outro paciente nesta clínica.'
    if (msg.includes('cpf'))
      return 'Este CPF já está cadastrado para outro paciente nesta clínica.'
    if (msg.includes('email'))
      return 'Este e-mail já está em uso.'
    if (msg.includes('patient') || msg.includes('paciente'))
      return 'Este paciente já está cadastrado.'
    return 'Este registro já existe no sistema.'
  }

  // Chave estrangeira
  if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
    return 'Não é possível excluir pois existem registros vinculados a este item.'
  }

  // Campo obrigatório
  if (msg.includes('not-null') || msg.includes('null value') || msg.includes('violates not-null')) {
    return 'Preencha todos os campos obrigatórios antes de salvar.'
  }

  // Valor muito longo
  if (msg.includes('value too long') || msg.includes('character varying')) {
    return 'Um dos campos está muito longo. Reduza o texto e tente novamente.'
  }

  // Permissão negada
  if (msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('rls')) {
    return 'Você não tem permissão para realizar esta ação.'
  }

  // Sessão expirada
  if (msg.includes('jwt expired') || msg.includes('token expired') || msg.includes('invalid jwt')) {
    return 'Sua sessão expirou. Recarregue a página e faça login novamente.'
  }

  // Erro de conexão / rede
  if (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch error') ||
    msg.includes('networkerror') ||
    msg.includes('connection')
  ) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.'
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'A operação demorou demais. Tente novamente.'
  }

  // Banco indisponível
  if (msg.includes('connection refused') || msg.includes('econnrefused')) {
    return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.'
  }

  // Valor inválido
  if (msg.includes('invalid input') || msg.includes('invalid value')) {
    return 'Um dos valores informados é inválido. Verifique os campos e tente novamente.'
  }

  // Erro genérico — retorna a mensagem original se for curta e legível
  const original = (error as { message?: string })?.message || ''
  if (original && original.length < 80 && !original.includes('supabase') && !original.includes('postgres')) {
    return original
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
