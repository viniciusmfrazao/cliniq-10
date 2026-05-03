import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { startOfDayBR, startOfMonthBR } from '@/lib/datetime'

export const metadata = {
  title: 'Eva IA | Clinike',
}

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

  // Estatisticas: tudo no fuso de Brasilia (servidor roda em UTC)
  const startOfToday = startOfDayBR()
  const startOfMonth = startOfMonthBR()

  const { count: totalConversations } = await supabase
    .from('eva_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData.clinic_id)

  const { count: todayConversations } = await supabase
    .from('eva_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData.clinic_id)
    .gte('created_at', startOfToday)

  const { count: monthConversations } = await supabase
    .from('eva_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData.clinic_id)
    .gte('created_at', startOfMonth)

  // Buscar leads gerados pela Eva
  const { count: leadsFromEva } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData.clinic_id)
    .eq('source', 'whatsapp')

  // Buscar últimas conversas
  const { data: recentConversations } = await supabase
    .from('eva_conversations')
    .select('*')
    .eq('clinic_id', userData.clinic_id)
    .order('updated_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-2xl">✨</span> Eva IA
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Sua assistente virtual de atendimento</p>
        </div>
        <Link 
          href="/dashboard/config/eva" 
          className="btn-secondary px-4 py-2 flex items-center gap-2"
        >
          <Icon name="settings" className="w-4 h-4" />
          Configurar
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon name="message" className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{todayConversations || 0}</p>
          <p className="text-xs text-slate-500">Conversas hoje</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon name="calendar" className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{monthConversations || 0}</p>
          <p className="text-xs text-slate-500">Este mês</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Icon name="users" className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalConversations || 0}</p>
          <p className="text-xs text-slate-500">Total conversas</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon name="target" className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{leadsFromEva || 0}</p>
          <p className="text-xs text-slate-500">Leads gerados</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Link 
          href="/dashboard/whatsapp" 
          className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Icon name="message" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">WhatsApp</h3>
            <p className="text-sm text-slate-500">Ver conversas e responder</p>
          </div>
          <Icon name="chevronRight" className="w-5 h-5 text-slate-300 ml-auto" />
        </Link>

        <Link 
          href="/dashboard/crm" 
          className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Icon name="target" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">CRM</h3>
            <p className="text-sm text-slate-500">Gerenciar leads e funil</p>
          </div>
          <Icon name="chevronRight" className="w-5 h-5 text-slate-300 ml-auto" />
        </Link>
      </div>

      {/* Recent Conversations */}
      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Conversas recentes</h2>
        </div>
        
        {!recentConversations || recentConversations.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon name="message" className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">Nenhuma conversa ainda</p>
            <p className="text-xs text-slate-400 mt-1">As conversas da Eva aparecerão aqui</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentConversations.map((conv: any) => (
              <Link
                key={conv.id}
                href={`/dashboard/whatsapp?phone=${encodeURIComponent(conv.phone)}`}
                className="block p-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {conv.customer_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{conv.customer_name || conv.phone}</p>
                      <p className="text-xs text-slate-500">{conv.phone}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
