/**
 * Detecta se o valor digitado é um telefone internacional (não-BR).
 * Convenção: número internacional é digitado/salvo com "+" na frente
 * (ex: "+1 305 555 0100"). Sem "+", assume-se BR e aplica a máscara padrão.
 */
export function isInternationalPhone(value: string | null | undefined): boolean {
  if (!value) return false
  return value.trim().startsWith('+')
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return ''

  // Internacional: não aplica máscara BR, só limpa caracteres inválidos,
  // preservando o "+" e os dígitos como o usuário digitou.
  if (isInternationalPhone(value)) {
    return '+' + value.replace(/[^\d\s]/g, '').trim()
  }

  const numbers = value.replace(/\D/g, '')
  
  if (numbers.length <= 2) {
    return numbers
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  }
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

export function maskCPF(value: string | null | undefined): string {
  if (!value) return ''
  const numbers = value.replace(/\D/g, '')
  
  if (numbers.length <= 3) {
    return numbers
  }
  if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
  }
  if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
  }
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
}

export function unmask(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function maskCEP(value: string | null | undefined): string {
  if (!value) return ''
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 5) {
    return numbers
  }
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
}

export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '')
  
  if (numbers.length !== 11) return false
  if (/^(\d)\1+$/.test(numbers)) return false
  
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i)
  }
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== parseInt(numbers[9])) return false
  
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i)
  }
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== parseInt(numbers[10])) return false
  
  return true
}

export function validatePhone(phone: string): boolean {
  const numbers = phone.replace(/\D/g, '')
  if (isInternationalPhone(phone)) {
    // Internacional: código do país + número, tipicamente 8-15 dígitos ao todo
    return numbers.length >= 8 && numbers.length <= 15
  }
  return numbers.length >= 10 && numbers.length <= 11
}

/**
 * Reduz QUALQUER formato de telefone brasileiro a uma chave canônica única,
 * usada para DETECTAR DUPLICATAS de paciente. Resolve os 3 problemas que
 * fazem o mesmo número entrar duplicado:
 *   1. máscara: "(34) 99180-5722" -> "34991805722"
 *   2. código do país: "5534991805722" -> "34991805722"
 *   3. nono dígito de celular: "34991805722" -> "3491805722"
 *
 * Exemplos que viram a MESMA chave "3491805722":
 *   "5534991805722", "34991805722", "(34) 99180-5722"
 *
 * NÃO usar para enviar mensagem — só para comparar/detectar duplicata.
 */
export function phoneCanonical(raw: string | null | undefined): string {
  if (!raw) return ''
  // Internacional (com "+"): não aplica heurística de DDD/nono dígito BR,
  // só limpa a formatação, mantendo o código do país.
  if (isInternationalPhone(raw)) {
    return raw.replace(/\D/g, '')
  }
  let p = raw.replace(/\D/g, '')
  if (p.length >= 12 && p.startsWith('55')) p = p.slice(2)
  if (p.length === 11 && p[2] === '9') p = p.slice(0, 2) + p.slice(3)
  return p
}
