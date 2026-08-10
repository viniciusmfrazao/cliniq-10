import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { restartInstance, getConnectionState, mapEvolutionStateToStatus } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/whatsapp/restart-all?confirm=1
 *
 * Reinicia o socket de TODAS as instâncias WhatsApp cadastradas em
 * clinic_whatsapp, uma por uma (sem apagar sessão/pairing — mesmo
 * mecanismo do botão de restart individual em /api/whatsapp/instance/restart).
 *
 * Criada em resposta a um incidente onde uma instance mostrava
 * connectionState "open" (e o painel da Evolution também dizia
 * "Connected"), mas o envio de mensagem falhava com
 * "Evolution 400: Connection Closed" — socket zumbi. O restart em massa
 * aqui serve tanto pra resolver o incidente pontual quanto pra checar
 * se outras clínicas estão no mesmo estado, sem precisar abrir uma por
 * uma no painel.
 *
 * GET com ?confirm=1 (em vez de POST) de propósito: precisa ser
 * acionável só abrindo o link no navegador do celular, sem precisar de
 * fetch/JS externo nem terminal. Sem confirm=1 mostra uma tela de
 * confirmação em vez de rodar direto.
 *
 * Atualiza clinic_whatsapp.status/health_* com o resultado real pós-restart,
 * pra o painel já refletir a realidade na próxima carga.
 */
export async function GET(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirm = req.nextUrl.searchParams.get('confirm')
  if (confirm !== '1') {
    return new NextResponse(confirmPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const svc = createServiceClient()
  const { data: rows, error } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, instance_name, clinics(name)')
    .order('instance_name')

  if (error || !rows) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao buscar instâncias' },
      { status: 500 },
    )
  }

  type Row = { clinic_id: string; instance_name: string; clinics: { name: string } | null }

  const results: {
    instance_name: string
    clinic_name: string
    before: string
    after: string
    needsAttention: boolean
  }[] = []

  for (const row of rows as unknown as Row[]) {
    const clinicName = row.clinics?.name || row.clinic_id

    const beforeState = await getConnectionState(row.instance_name)
    const before = beforeState.ok
      ? beforeState.data.instance?.state || 'unknown'
      : beforeState.status === 404
        ? 'not_found'
        : `error: ${beforeState.error}`

    if (before === 'not_found') {
      results.push({
        instance_name: row.instance_name,
        clinic_name: clinicName,
        before,
        after: 'n/a',
        needsAttention: true,
      })
      continue
    }

    await restartInstance(row.instance_name)
    await new Promise((r) => setTimeout(r, 4000))

    const afterState = await getConnectionState(row.instance_name)
    const after = afterState.ok
      ? afterState.data.instance?.state || 'unknown'
      : `error: ${afterState.error}`

    const status = mapEvolutionStateToStatus(after)
    const needsAttention = after !== 'open'

    await svc
      .from('clinic_whatsapp')
      .update({
        status,
        health_warning: needsAttention,
        health_reason: needsAttention ? `restart_check:${after}` : null,
        health_checked_at: new Date().toISOString(),
      })
      .eq('instance_name', row.instance_name)

    results.push({
      instance_name: row.instance_name,
      clinic_name: clinicName,
      before,
      after,
      needsAttention,
    })
  }

  return new NextResponse(reportPage(results), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function confirmPage() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restart em lote · Clinike</title></head>
  <body style="font-family:-apple-system,system-ui,sans-serif;background:#0b0f0d;color:#e8ede9;padding:24px;margin:0">
    <h2 style="margin-top:0">Restart em lote — Evolution API</h2>
    <p style="color:#9fb0a8;line-height:1.5">
      Vai reiniciar o socket de <b>todas</b> as instâncias WhatsApp em produção,
      uma por uma (sem apagar sessão nem pedir QR novo). Demora alguns segundos
      por instância.
    </p>
    <a href="?confirm=1" style="display:inline-block;margin-top:12px;padding:14px 22px;
      background:#35d08a;color:#05130c;border-radius:10px;text-decoration:none;font-weight:700">
      Confirmar e rodar
    </a>
  </body></html>`
}

function reportPage(
  results: {
    instance_name: string
    clinic_name: string
    before: string
    after: string
    needsAttention: boolean
  }[],
) {
  const attention = results.filter((r) => r.needsAttention)

  const rowsHtml = results
    .map(
      (r) => `
    <tr style="border-bottom:1px solid #1f2a25">
      <td style="padding:10px 6px">
        <div style="font-weight:600">${escapeHtml(r.clinic_name)}</div>
        <div style="font-family:monospace;font-size:11px;color:#7f8f87">${escapeHtml(r.instance_name)}</div>
      </td>
      <td style="padding:10px 6px;font-family:monospace;font-size:12px;color:#7f8f87">${escapeHtml(r.before)}</td>
      <td style="padding:10px 6px;font-family:monospace;font-size:12px;color:${r.needsAttention ? '#ef5b5b' : '#35d08a'}">${escapeHtml(r.after)}</td>
    </tr>`,
    )
    .join('')

  const summaryHtml =
    attention.length === 0
      ? `<p style="color:#35d08a;font-weight:700">Todas as ${results.length} instâncias voltaram para "open".</p>`
      : `<p style="color:#ef5b5b;font-weight:700">${attention.length} instância(s) precisam de atenção manual (reconectar / QR novo):</p>
         <ul style="color:#e8ede9;line-height:1.6">${attention
           .map((r) => `<li>${escapeHtml(r.clinic_name)} — <code>${escapeHtml(r.after)}</code></li>`)
           .join('')}</ul>`

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restart em lote · Resultado</title></head>
  <body style="font-family:-apple-system,system-ui,sans-serif;background:#0b0f0d;color:#e8ede9;padding:20px;margin:0;max-width:720px">
    <h2 style="margin-top:0">Restart em lote — resultado</h2>
    ${summaryHtml}
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="text-align:left;font-size:11px;color:#7f8f87;text-transform:uppercase;letter-spacing:.05em">
          <th style="padding:8px 6px">Clínica</th><th style="padding:8px 6px">Antes</th><th style="padding:8px 6px">Depois</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body></html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
