import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import BirthdayAutomationForm from './birthday-form'
import BirthdayHistory from './birthday-history'
import AppointmentReminderForm from './reminder-form'
import ReminderHistory from './reminder-history'
import RecallForm from './recall-form'
import RecallHistory from './recall-history'
import NpsForm from './nps-form'
import NpsHistory from './nps-history'

export const dynamic = 'force-dynamic'

export default async function AutomacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.clinic_id) redirect('/dashboard')
  if (!['admin', 'manager'].includes(userRow.role)) {
    redirect('/dashboard/config')
  }

  const clinicId = userRow.clinic_id

  // Usamos select('*') pra ser tolerante a schemas que ainda não rodaram
  // os SQLs opcionais (supabase-birthday-automation.sql, etc).
  const [{ data: automation }, { data: whatsapp }, { data: clinic }] = await Promise.all([
    supabase
      .from('clinic_automations')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    supabase
      .from('clinic_whatsapp')
      .select('status, phone_number')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    supabase.from('clinics').select('id, name').eq('id', clinicId).maybeSingle(),
  ])

  type AutomationRow = {
    aniversario?: boolean | null
    aniversario_hora?: number | null
    aniversario_optin_required?: boolean | null
    template_aniversario?: string | null
    confirma_24h?: boolean | null
    confirma_24h_hora?: number | null
    template_confirma_24h?: string | null
    lembrete_2h?: boolean | null
    template_lembrete_2h?: string | null
    recall_inativos?: boolean | null
    recall_dias?: number | null
    template_recall?: string | null
    nps_pos_atendimento?: boolean | null
    template_nps?: string | null
    nps_imediato?: boolean | null
    nps_delay_minutes?: number | null
  }
  const auto = (automation || null) as AutomationRow | null

  const whatsappConnected = whatsapp?.status === 'connected'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/config"
            className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
            Voltar
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mt-2">Automações</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mensagens automáticas que o sistema envia pelos seus pacientes
          </p>
        </div>
      </div>

      {/* Status WhatsApp */}
      {!whatsappConnected && (
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Icon name="alertCircle" className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">WhatsApp não conectado</p>
              <p className="text-sm text-amber-700 mt-1">
                As automações precisam que o WhatsApp da clínica esteja conectado pra enviar
                mensagens. As mensagens são enfileiradas e perdem o lugar do dia se o número
                não estiver pronto.
              </p>
              <Link
                href="/dashboard/config/whatsapp"
                className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-sm font-medium"
              >
                Configurar WhatsApp
                <Icon name="chevronRight" className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Aniversário */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md">
            <span className="text-2xl">🎂</span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Mensagem de aniversário</h2>
            <p className="text-sm text-slate-500">
              Enviada automaticamente no dia do aniversário do paciente
            </p>
          </div>
        </div>

        <BirthdayAutomationForm
          clinicId={clinicId}
          clinicName={clinic?.name || 'Clínica'}
          initial={{
            enabled: auto?.aniversario ?? true,
            hour: auto?.aniversario_hora ?? 9,
            optinRequired: auto?.aniversario_optin_required ?? true,
            template: auto?.template_aniversario || '',
          }}
        />
      </div>

      {/* Histórico de aniversários */}
      <BirthdayHistory clinicId={clinicId} />

      {/* Lembrete de consulta (D-1) */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
            <span className="text-2xl">📅</span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Lembrete de consulta</h2>
            <p className="text-sm text-slate-500">
              Enviado todo dia às 20h pra quem tem consulta no dia seguinte
            </p>
          </div>
        </div>

        <AppointmentReminderForm
          clinicId={clinicId}
          clinicName={clinic?.name || 'Clínica'}
          initial={{
            enabled: auto?.confirma_24h ?? true,
            hora: auto?.confirma_24h_hora ?? 20,
            template24h: auto?.template_confirma_24h || '',
            lembrete2hEnabled: auto?.lembrete_2h ?? false,
            template2h: auto?.template_lembrete_2h || '',
          }}
        />
      </div>

      {/* Histórico de lembretes */}
      <ReminderHistory clinicId={clinicId} />

      {/* Recall de inativos */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
            <span className="text-2xl">💌</span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Recall de inativos</h2>
            <p className="text-sm text-slate-500">
              Mensagem todo dia às 10h pra pacientes que não voltam há um tempo
            </p>
          </div>
        </div>

        <RecallForm
          clinicId={clinicId}
          clinicName={clinic?.name || 'Clínica'}
          initial={{
            enabled: auto?.recall_inativos ?? false,
            diasInativo: auto?.recall_dias ?? 150,
            template: auto?.template_recall || '',
          }}
        />
      </div>

      {/* Histórico de recall */}
      <RecallHistory clinicId={clinicId} />

      {/* NPS pós-atendimento */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
            <span className="text-2xl">⭐</span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">NPS pós-atendimento</h2>
            <p className="text-sm text-slate-500">
              Pesquisa de satisfação automática — escolha enviar imediatamente ou no dia seguinte
            </p>
          </div>
        </div>

        <NpsForm
          clinicId={clinicId}
          clinicName={clinic?.name || 'Clínica'}
          initial={{
            enabled: auto?.nps_pos_atendimento ?? false,
            template: auto?.template_nps || '',
            imediato: auto?.nps_imediato ?? false,
            delayMinutes: auto?.nps_delay_minutes ?? 30,
          }}
        />
      </div>

      {/* Histórico de NPS */}
      <NpsHistory clinicId={clinicId} />

      {/* Outras automações (placeholder) */}
      <div className="card p-6 bg-slate-50 border-dashed border-2 border-slate-200">
        <p className="text-sm text-slate-500 text-center">
          Mais automações em breve: lembrete 2h antes (plano Pro), follow-up de lead,
          reativação de lead perdido, relatório semanal…
        </p>
      </div>
    </div>
  )
}
