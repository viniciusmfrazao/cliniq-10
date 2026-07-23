'use client'

import { useRef } from 'react'
import Icon from '@/components/ui/Icon'

type Props = {
  patientName: string
  clinicName: string
  completedAtLabel: string
  signatureIp: string | null
  signatureUserAgent: string | null
  signatureCountry: string | null
  signatureDataUrl: string | null
  bodyHtml: string
}

/**
 * Exporta a ficha de anamnese em PDF via impressão do navegador
 * (mesmo padrão usado em /dashboard/documentos/recibo). Evita depender
 * de lib de geração de PDF no servidor (ex: puppeteer), que é pesada
 * e frágil em serverless/Vercel.
 */
export default function ExportAnamnesePdfButton({
  patientName,
  clinicName,
  completedAtLabel,
  signatureIp,
  signatureUserAgent,
  signatureCountry,
  signatureDataUrl,
  bodyHtml,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  function handleExport() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ficha de Anamnese - ${patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #1a1410;
              font-size: 13px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #1a1410;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .header h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
            .header .sub { font-size: 12px; color: #666; }
            .section { margin-bottom: 18px; page-break-inside: avoid; }
            .section h2 {
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              border-bottom: 1px solid #ccc;
              padding-bottom: 6px;
              margin-bottom: 10px;
              color: #444;
            }
            .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
            .row .label { color: #666; }
            .row .value { font-weight: 600; text-align: right; max-width: 60%; }
            .meta-box {
              margin-top: 30px;
              padding: 14px;
              border: 1px solid #ddd;
              border-radius: 6px;
              background: #fafafa;
              font-size: 11px;
              color: #555;
            }
            .meta-box p { margin-bottom: 4px; }
            .signature-img { max-width: 250px; margin-top: 10px; border: 1px solid #ddd; padding: 8px; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ficha de Anamnese</h1>
            <div class="sub">${clinicName} — ${patientName}</div>
          </div>
          ${bodyHtml}
          ${signatureDataUrl ? `
          <div class="section">
            <h2>Assinatura Digital</h2>
            <img class="signature-img" src="${signatureDataUrl}" />
          </div>` : ''}
          <div class="meta-box">
            <p><strong>Registro da assinatura eletrônica</strong></p>
            <p>Preenchido/assinado em: ${completedAtLabel}</p>
            <p>Endereço IP: ${signatureIp || '-'}</p>
            <p>Dispositivo: ${signatureUserAgent || '-'}</p>
            <p>País: ${signatureCountry || '-'}</p>
          </div>
          <div class="footer">Documento gerado por Clinike em ${new Date().toLocaleString('pt-BR')}</div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <>
      <button
        onClick={handleExport}
        className="btn-secondary inline-flex items-center gap-2"
      >
        <Icon name="printer" className="w-4 h-4" />
        Exportar PDF
      </button>
      <div ref={printRef} className="hidden" />
    </>
  )
}
