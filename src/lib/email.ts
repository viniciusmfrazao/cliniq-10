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
