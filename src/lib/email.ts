import { Resend } from 'resend'

const FROM = 'Clinike <noreply@clinike.com.br>'
const APP_URL = 'https://app.clinike.com.br'

export async function sendWelcomeEmail({
  to,
  adminName,
  clinicName,
  email,
  password,
}: {
  to: string
  adminName: string
  clinicName: string
  email: string
  password: string
}) {
  const firstName = adminName.split(' ')[0]

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Clinike</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Clinike</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">Gestão inteligente para clínicas</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">
                Olá, ${firstName}! 👋
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                O acesso da <strong style="color:#1e293b;">${clinicName}</strong> ao Clinike está pronto. Abaixo estão suas credenciais de acesso:
              </p>

              <!-- Credenciais -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;">
                    <div style="margin-bottom:16px;">
                      <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Usuário</div>
                      <div style="font-size:15px;color:#1e293b;font-family:monospace;font-weight:500;">${email}</div>
                    </div>
                    <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                      <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Senha</div>
                      <div style="font-size:18px;color:#1e293b;font-family:monospace;font-weight:700;letter-spacing:2px;">${password}</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/login"
                       style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:10px;">
                      Acessar o Clinike →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;text-align:center;">
                Ou acesse diretamente em:
              </p>
              <p style="margin:0;font-size:13px;color:#7c3aed;text-align:center;">
                <a href="${APP_URL}/login" style="color:#7c3aed;">${APP_URL}/login</a>
              </p>
            </td>
          </tr>

          <!-- Aviso de segurança -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 16px;">
                <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
                  🔒 <strong>Importante:</strong> Recomendamos alterar sua senha no primeiro acesso usando <strong>"Esqueci minha senha"</strong> na tela de login.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Este email foi enviado automaticamente pelo Clinike.<br>
                Em caso de dúvidas, entre em contato com o suporte.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurada — email de boas-vindas não enviado')
    return null
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Seu acesso ao Clinike está pronto — ${clinicName}`,
    html,
  })
}

export async function sendWhatsappDisconnectedEmail({
  to,
  clinicName,
  instanceLabel,
}: {
  to: string[]
  clinicName: string
  instanceLabel: string
}) {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp desconectado</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Clinike</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Alerta de conexão</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">
                ⚠️ WhatsApp desconectado
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                O número <strong style="color:#1e293b;">${instanceLabel}</strong> da <strong style="color:#1e293b;">${clinicName}</strong> foi desconectado do Clinike. Enquanto estiver desconectado, mensagens automáticas, lembretes e a Eva não vão funcionar.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/configuracoes/whatsapp"
                       style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:10px;">
                      Reconectar agora →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Este email foi enviado automaticamente pelo Clinike quando detectamos a queda da conexão.<br>
                Em caso de dúvidas, entre em contato com o suporte.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurada — email de WhatsApp desconectado não enviado')
    return null
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  return resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ WhatsApp desconectado — ${clinicName}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Alertas operacionais (WhatsApp fora do ar / reconectado)
// ---------------------------------------------------------------------------

/** Email do fundador que recebe todos os alertas operacionais. */
export const FOUNDER_ALERT_EMAIL =
  process.env.ALERT_EMAIL || 'viniciusmfrazao@gmail.com'

function alertEmailHtml({
  accent,
  badge,
  title,
  intro,
  rows,
  ctaLabel,
  ctaUrl,
  note,
}: {
  accent: string
  badge: string
  title: string
  intro: string
  rows: Array<{ label: string; value: string }>
  ctaLabel?: string
  ctaUrl?: string
  note?: string
}) {
  const rowsHtml = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding:${i === 0 ? '0' : '12px'} 0 0;${i === 0 ? '' : 'border-top:1px solid #e2e8f0;'}">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${r.label}</div>
          <div style="font-size:15px;color:#1e293b;font-weight:500;">${r.value}</div>
        </td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <tr>
          <td style="background:${accent};padding:32px 40px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Clinike</div>
            <div style="display:inline-block;margin-top:10px;background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;">${badge}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 8px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e293b;">${title}</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">${intro}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;"><table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
            </table>
          </td>
        </tr>

        ${
          ctaLabel && ctaUrl
            ? `<tr><td style="padding:0 40px 32px;" align="center">
            <a href="${ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;">${ctaLabel}</a>
          </td></tr>`
            : ''
        }

        ${
          note
            ? `<tr><td style="padding:0 40px 32px;">
            <div style="background:#f1f5f9;border-radius:10px;padding:14px 16px;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">${note}</p>
            </div>
          </td></tr>`
            : ''
        }

        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Alerta automático do monitoramento Clinike.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const DOWN_REASON_LABEL: Record<string, string> = {
  instance_not_found: 'Sessão removida do servidor (precisa ler o QR Code de novo)',
  evolution_state_close: 'Conexão encerrada pelo WhatsApp (celular offline ou sessão expirada)',
}

function formatBR(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Alerta de WhatsApp desconectado.
 *
 * `audience` muda o tom: 'founder' inclui dados técnicos (instance, motivo cru),
 * 'clinic' fala em linguagem de usuária final com o passo pra resolver.
 */
export async function sendWhatsappDownEmail({
  to,
  clinicName,
  audience,
  instanceName,
  phoneNumber,
  reason,
  downSince,
}: {
  to: string[]
  clinicName: string
  audience: 'founder' | 'clinic'
  instanceName: string
  phoneNumber: string | null
  reason: string | null
  downSince: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[alerts] RESEND_API_KEY ausente — alerta de queda não enviado')
    return null
  }
  if (!to.length) return null

  const reasonLabel =
    (reason && DOWN_REASON_LABEL[reason]) || 'Motivo não identificado'

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Clínica', value: clinicName },
    { label: 'Número', value: phoneNumber || 'não identificado' },
    { label: 'Sem conexão desde', value: formatBR(downSince) },
    { label: 'Motivo provável', value: reasonLabel },
  ]

  if (audience === 'founder') {
    rows.push({ label: 'Instance', value: instanceName })
    if (reason) rows.push({ label: 'health_reason', value: reason })
  }

  const html = alertEmailHtml({
    accent: '#dc2626',
    badge: 'WhatsApp desconectado',
    title:
      audience === 'clinic'
        ? 'O WhatsApp da sua clínica está fora do ar'
        : `WhatsApp caiu — ${clinicName}`,
    intro:
      audience === 'clinic'
        ? 'Enquanto isso, mensagens automáticas (confirmações, lembretes e a Eva) não estão sendo enviadas nem recebidas. É só reconectar pelo painel para voltar ao normal.'
        : 'A checagem automática confirmou a queda em dois ciclos seguidos. A clínica também será avisada se não voltar.',
    rows,
    ctaLabel: 'Reconectar WhatsApp',
    ctaUrl: `${APP_URL}/dashboard/config/whatsapp`,
    note:
      audience === 'clinic'
        ? 'Como reconectar: acesse Configurações → WhatsApp, clique em Conectar e leia o QR Code com o celular da clínica. Você recebe um e-mail assim que a conexão for restabelecida.'
        : undefined,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  return resend.emails.send({
    from: FROM,
    to,
    subject:
      audience === 'clinic'
        ? '⚠️ WhatsApp desconectado — ação necessária'
        : `⚠️ WhatsApp caiu — ${clinicName}`,
    html,
  })
}

/** Aviso de reconexão, enviado só para quem recebeu o alerta de queda. */
export async function sendWhatsappRecoveredEmail({
  to,
  clinicName,
  phoneNumber,
  downSince,
}: {
  to: string[]
  clinicName: string
  phoneNumber: string | null
  downSince: string | null
}) {
  if (!process.env.RESEND_API_KEY) return null
  if (!to.length) return null

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Clínica', value: clinicName },
    { label: 'Número', value: phoneNumber || 'não identificado' },
  ]
  if (downSince) {
    rows.push({ label: 'Ficou fora do ar desde', value: formatBR(downSince) })
  }
  rows.push({ label: 'Reconectado em', value: formatBR(new Date().toISOString()) })

  const html = alertEmailHtml({
    accent: '#059669',
    badge: 'Conexão restabelecida',
    title: `WhatsApp reconectado — ${clinicName}`,
    intro:
      'A conexão voltou e as mensagens automáticas já estão sendo enviadas normalmente. Nenhuma ação é necessária.',
    rows,
    note: 'Mensagens recebidas enquanto o WhatsApp esteve fora do ar podem não ter sido registradas no sistema — vale conferir a caixa de entrada do celular.',
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  return resend.emails.send({
    from: FROM,
    to,
    subject: `✅ WhatsApp reconectado — ${clinicName}`,
    html,
  })
}
