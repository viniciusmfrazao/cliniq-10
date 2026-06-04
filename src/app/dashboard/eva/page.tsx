import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { startOfDayBR, startOfMonthBR } from '@/lib/datetime'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Eva IA | Clinike' }

export default async function EvaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) redirect('/login')
  const clinicId = userData.clinic_id

  // Verificar módulo eva_ia
  const { data: clinicData } = await supabase
    .from('clinics')
    .select('settings, name')
    .eq('id', clinicId)
    .single()

  const activeModules: string[] = clinicData?.settings?.active_modules || []
  if (activeModules.length > 0 && !activeModules.includes('eva_ia')) {
    redirect('/dashboard')
  }

  const startOfToday = startOfDayBR()
  const startOfMonth = startOfMonthBR()

  // ── Métricas de ROI ────────────────────────────────────────────
  const [
    { count: conversasHoje },
    { count: conversasMes },
    { count: conversasTotal },
    { count: leadsGeradosMes },
    { count: leadsConvertidos },
    { count: leadsTotal },
    agendamentosEvaRes,
    followupsRes,
    recentConvRes,
    mensagensProcessadasRes,
    evaStatusRes,
  ] = await Promise.all([
    // Conversas hoje
    supabase.from('eva_conversations').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).gte('created_at', startOfToday),
    // Conversas mês
    supabase.from('eva_conversations').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).gte('created_at', startOfMonth),
    // Conversas total
    supabase.from('eva_conversations').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
    // Leads gerados este mês via WhatsApp
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).eq('source', 'whatsapp')
      .gte('created_at', startOfMonth),
    // Leads convertidos (total histórico)
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).eq('source', 'whatsapp')
      .in('status', ['scheduled', 'converted', 'client']),
    // Leads whatsapp total
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).eq('source', 'whatsapp'),
    // Agendamentos feitos PELA EVA no chat este mês (mais preciso)
    supabase.from('eva_logs')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('event', 'booking')
      .eq('status', 'ok')
      .gte('created_at', startOfMonth),
    // Follow-ups enviados este mês — via eva_logs (preciso)
    supabase.from('eva_logs')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('source', 'cron-followup')
      .eq('event', 'followup')
      .eq('status', 'ok')
      .gte('created_at', startOfMonth),
    // Conversas recentes
    supabase.from('eva_conversations')
      .select('id, phone, customer_name, updated_at')
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false })
      .limit(8),
    // Mensagens processadas este mês
    supabase.from('eva_logs')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('source', 'eva-process')
      .eq('event', 'processed')
      .eq('status', 'ok')
      .gte('created_at', startOfMonth),
    // Status Eva (auto_reply_enabled)
    supabase.from('clinic_whatsapp')
      .select('auto_reply_enabled, instance_name, phone_number, status')
      .eq('clinic_id', clinicId)
      .eq('auto_reply_enabled', true)
      .limit(1),
  ])

  // Calcular taxa de conversão
  const taxaConversao = leadsTotal && leadsTotal > 0
    ? Math.round(((leadsConvertidos || 0) / leadsTotal) * 100)
    : 0

  // Follow-ups enviados este mês (via eva_logs — preciso)
  const followupsSent = followupsRes.count || 0

  // Agendamentos Eva mês
  const agendamentosEva = agendamentosEvaRes.count || 0

  const mensagensProcessadas = mensagensProcessadasRes.count || 0
  const taxaBookingChat = mensagensProcessadas > 0
    ? Math.round((agendamentosEva / mensagensProcessadas) * 100)
    : 0
  const evaOnline = (evaStatusRes.data?.length ?? 0) > 0

  const recentConversations = recentConvRes.data || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            ✨ Eva IA
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              evaOnline
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {evaOnline ? '● Ativa' : '○ Inativa'}
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Sua assistente virtual de atendimento</p>
        </div>
        <Link href="/dashboard/config/eva" className="btn-secondary px-4 py-2 flex items-center gap-2 text-sm">
          <Icon name="settings" className="w-4 h-4" />
          Configurar
        </Link>
      </div>

      {/* ROI — Conversão */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Conversas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            value={conversasHoje || 0}
            label="Hoje"
            icon="message"
            color="violet"
          />
          <StatCard
            value={conversasMes || 0}
            label="Este mês"
            icon="calendar"
            color="blue"
          />
          <StatCard
            value={conversasTotal || 0}
            label="Total histórico"
            icon="users"
            color="slate"
          />
          <StatCard
            value={followupsSent}
            label="Follow-ups (mês)"
            icon="bell"
            color="amber"
          />
          <StatCard
            value={mensagensProcessadas}
            label="Msgs processadas"
            icon="zap"
            color="teal"
          />
        </div>
      </div>

      {/* ROI — Leads e Agendamentos */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Conversão em negócios
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            value={leadsGeradosMes || 0}
            label="Leads gerados (mês)"
            icon="target"
            color="emerald"
          />
          <StatCard
            value={agendamentosEva}
            label="Agendamentos (mês)"
            icon="calendar"
            color="green"
          />
          <StatCard
            value={leadsConvertidos || 0}
            label="Convertidos (total)"
            icon="userCheck"
            color="teal"
          />
          <div className="rounded-xl p-4 bg-violet-50 dark:bg-violet-900/20">
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center mb-2">
              <Icon name="trendingUp" className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{taxaConversao}%</p>
            <p className="text-xs text-slate-500 mt-0.5">Taxa de conversão</p>
            <p className="text-[10px] text-slate-400 mt-0.5">leads → clientes</p>
          </div>
        </div>
      </div>

      {/* Funil visual */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Funil Eva este mês</h3>
        <div className="space-y-2">
          <FunnelBar label="Conversas" value={conversasMes || 0} max={conversasMes || 1} color="bg-violet-500" />
          <FunnelBar label="Leads gerados" value={leadsGeradosMes || 0} max={conversasMes || 1} color="bg-blue-500" />
          <FunnelBar label="Agendamentos" value={agendamentosEva} max={conversasMes || 1} color="bg-emerald-500" />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="info" className="w-3.5 h-3.5 flex-shrink-0" />
          Agendamentos criados pela Eva no chat · Taxa de booking: {taxaBookingChat}% das msgs processadas
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/dashboard/whatsapp" className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <Icon name="message" className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">WhatsApp</h3>
            <p className="text-xs text-slate-500 truncate">Ver e responder conversas</p>
          </div>
          <Icon name="chevronRight" className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0" />
        </Link>
        <Link href="/dashboard/crm" className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <Icon name="target" className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">CRM</h3>
            <p className="text-xs text-slate-500 truncate">Gerenciar leads e funil</p>
          </div>
          <Icon name="chevronRight" className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0" />
        </Link>
      </div>

      {/* Conversas recentes */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Conversas recentes</h2>
          <Link href="/dashboard/whatsapp" className="text-xs text-violet-600 hover:underline">Ver todas →</Link>
        </div>
        {recentConversations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {recentConversations.map((conv: any) => (
              <Link
                key={conv.id}
                href={`/dashboard/whatsapp?phone=${encodeURIComponent(conv.phone)}`}
                className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-violet-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {conv.customer_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {conv.customer_name || conv.phone}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{conv.phone}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, icon, color }: {
  value: number
  label: string
  icon: string
  color: string
}) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-500',
    blue:   'bg-blue-500',
    slate:  'bg-slate-500',
    amber:  'bg-amber-500',
    emerald:'bg-emerald-500',
    green:  'bg-green-500',
    teal:   'bg-teal-500',
  }
  const bgs: Record<string, string> = {
    violet: 'bg-violet-50 dark:bg-violet-900/20',
    blue:   'bg-blue-50 dark:bg-blue-900/20',
    slate:  'bg-slate-50 dark:bg-slate-800',
    amber:  'bg-amber-50 dark:bg-amber-900/20',
    emerald:'bg-emerald-50 dark:bg-emerald-900/20',
    green:  'bg-green-50 dark:bg-green-900/20',
    teal:   'bg-teal-50 dark:bg-teal-900/20',
  }
  return (
    <div className={`rounded-xl p-4 ${bgs[color] || bgs.slate}`}>
      <div className={`w-8 h-8 rounded-lg ${colors[color] || colors.slate} flex items-center justify-center mb-2`}>
        <Icon name={icon} className="w-4 h-4 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function FunnelBar({ label, value, max, color }: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
        <div
          className={`h-full ${color} rounded-lg transition-all flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        >
          <span className="text-[10px] text-white font-bold">{value}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  )
}
