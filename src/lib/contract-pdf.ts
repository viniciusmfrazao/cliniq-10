import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'

type ContractPdfInput = {
  clinicName: string
  content: string
  signerName: string
  signerCpf: string
  signerRole: string
  signedAtLabel: string
  signatureDataUrl: string | null
  signatureIp: string | null
  signatureUserAgent: string | null
  signatureCountry: string | null
}

const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN = 56
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    const words = paragraph.split(' ')
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

/**
 * Gera o PDF final do contrato assinado: texto do contrato + imagem da
 * assinatura + rodapé com metadados de evidência (IP, dispositivo, país).
 * Usa pdf-lib (sem puppeteer) para funcionar bem em serverless/Vercel.
 */
export async function generateContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage()
  }

  function drawLine(text: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = opts.size ?? 10.5
    const f = opts.f ?? font
    const gap = opts.gap ?? size * 1.4
    ensureSpace(gap)
    page.drawText(text, { x: MARGIN, y, size, font: f, color: opts.color ?? rgb(0.1, 0.1, 0.1) })
    y -= gap
  }

  // Cabeçalho
  drawLine('Contrato de Adesão — Clinike', { size: 16, f: boldFont, gap: 24 })
  drawLine(input.clinicName, { size: 11, color: rgb(0.35, 0.35, 0.35), gap: 22 })

  // Corpo do contrato
  const bodyLines = wrapText(input.content, font, 10.5, CONTENT_WIDTH)
  for (const line of bodyLines) {
    drawLine(line || ' ', { size: 10.5, gap: 14 })
  }

  // Assinatura
  ensureSpace(140)
  y -= 10
  drawLine('Assinatura Digital', { size: 12, f: boldFont, gap: 18 })

  if (input.signatureDataUrl?.startsWith('data:image/png')) {
    try {
      const base64 = input.signatureDataUrl.split(',')[1]
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
      const img = await pdfDoc.embedPng(bytes)
      const maxW = 220
      const scale = maxW / img.width
      const h = img.height * scale
      ensureSpace(h + 10)
      page.drawImage(img, { x: MARGIN, y: y - h, width: maxW, height: h })
      y -= h + 12
    } catch {
      // se a imagem falhar, segue sem travar a geração do PDF
    }
  }

  drawLine(`${input.signerName} — CPF ${input.signerCpf}`, { size: 10, f: boldFont, gap: 14 })
  drawLine(input.signerRole, { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 20 })

  // Rodapé com metadados de evidência
  ensureSpace(80)
  page.drawRectangle({
    x: MARGIN,
    y: y - 66,
    width: CONTENT_WIDTH,
    height: 66,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  })
  y -= 12
  drawLine('Registro da assinatura eletrônica', { size: 9.5, f: boldFont, gap: 13 })
  drawLine(`Assinado em: ${input.signedAtLabel}`, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 12 })
  drawLine(`IP: ${input.signatureIp || '-'}  •  País: ${input.signatureCountry || '-'}`, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 12 })
  drawLine(`Dispositivo: ${(input.signatureUserAgent || '-').slice(0, 90)}`, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 12 })

  return pdfDoc.save()
}
