// Gerador de payload Pix EMV (padrão BACEN)

function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase().padStart(4, '0'))
}

export function gerarPixEMV({
  chave,
  nome,
  cidade,
  valor,
  txid = '***',
  descricao = '',
}: {
  chave: string
  nome: string
  cidade: string
  valor: number
  txid?: string
  descricao?: string
}): string {
  const merchantAccountInfo = emvField('00', 'BR.GOV.BCB.PIX') +
    emvField('01', chave) +
    (descricao ? emvField('02', descricao.slice(0, 72)) : '')

  const valorStr = valor.toFixed(2)

  const payload =
    emvField('00', '01') +                          // Payload format indicator
    emvField('26', merchantAccountInfo) +            // Merchant account info
    emvField('52', '0000') +                         // MCC
    emvField('53', '986') +                          // BRL
    emvField('54', valorStr) +                       // Valor
    emvField('58', 'BR') +                           // Country
    emvField('59', nome.slice(0, 25)) +              // Nome beneficiário
    emvField('60', cidade.slice(0, 15)) +            // Cidade
    emvField('62', emvField('05', txid.slice(0, 25))) + // TxID
    '6304'                                           // CRC placeholder

  return payload + crc16(payload)
}

export function pixParaWhatsApp({
  nomePagador,
  valor,
  vencimento,
  pixPayload,
}: {
  nomePagador: string
  valor: number
  vencimento: string
  pixPayload: string
}): string {
  const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `Olá! 👋

Segue a cobrança do Clinike referente ao plano mensal.

💰 *Valor:* ${valorFmt}
📅 *Vencimento:* ${vencimento}

Copie o código Pix abaixo e cole no app do seu banco:

\`${pixPayload}\`

Em caso de dúvidas, estamos à disposição! 😊
*Equipe Clinike*`
}
