import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ClinicSettings from './clinic-settings'
import ThemeSelector from './theme-selector'

export default async function ConfigPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  // Debug: se não encontrou usuário
  if (userError || !currentUser) {
    console.error('Erro ao buscar usuário:', userError)
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 bg-red-50 border border-red-200">
          <h2 className="font-semibold text-red-800">Erro ao carregar configurações</h2>
          <p className="text-sm text-red-600 mt-2">
            Não foi possível encontrar seus dados. Verifique se você está cadastrado na tabela users.
          </p>
          <pre className="text-xs bg-red-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(userError, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  // Apenas admin/super_admin pode acessar configurações completas
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Buscar dados da clinica
  const { data: automations } = await supabase
    .from('clinic_automations')
    .select('relatorio_semanal, relatorio_telefones, relatorio_hora, relatorio_dia')
    .eq('clinic_id', currentUser.clinic_id)
    .maybeSingle()

  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', currentUser.clinic_id)
    .single()

  const activeModules: string[] = clinic?.settings?.active_modules || []
  const hasEva = activeModules.length === 0 || activeModules.includes('eva_ia')
  const hasNfse = activeModules.includes('nfse')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Configuracoes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {isAdmin ? 'Gerencie sua clinica e personalize o sistema' : 'Personalize suas preferencias'}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">🎨 Tema do sistema</h2>
          <ThemeSelector />
        </div>

        {isAdmin && (
          <>
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">🏥 Dados da clinica</h2>
              <ClinicSettings clinic={clinic} automations={automations} />
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">🔐 Permissões e Acessos</h2>
              <Link
                href="/dashboard/config/permissoes"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 rounded-xl transition-colors border border-violet-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow">
                  <Icon name="shield" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-violet-900">Permissões por papel</p>
                  <p className="text-xs text-violet-700">
                    Define o que cada cargo (médico, recepcionista, etc) acessa por padrão
                  </p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-violet-400" />
              </Link>
            </div>
          </>
        )}

        {!isAdmin && (
          <div className="card p-6 bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              Apenas administradores podem acessar as configurações da clínica.
              <br />
              Seu papel atual: <strong>{currentUser.role}</strong>
            </p>
          </div>
        )}

        {/* Central de Ajuda - disponível para todos */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">❓ Ajuda</h2>
          <Link 
            href="/dashboard/config/tutorial"
            className="flex items-center gap-4 p-4 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors border border-violet-200"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Icon name="info" className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-violet-900">Central de Ajuda</p>
              <p className="text-xs text-violet-600">Tutorial passo a passo de como usar o sistema</p>
            </div>
            <Icon name="chevronRight" className="w-5 h-5 text-violet-400" />
          </Link>
        </div>

        {/* Integrações - apenas admin */}
        {isAdmin && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">🔌 Integrações</h2>
            <div className="grid gap-3">
              <Link
                href="/dashboard/config/whatsapp"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 rounded-xl transition-colors border border-emerald-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">WhatsApp da Clínica</p>
                  <p className="text-xs text-emerald-700">Conecte via QR code e responda pacientes pelo sistema</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-emerald-400" />
              </Link>

              <Link
                href="/dashboard/config/automacoes"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 rounded-xl transition-colors border border-pink-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow">
                  <span className="text-lg">🎂</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-pink-900">Automações de WhatsApp</p>
                  <p className="text-xs text-pink-700">Mensagem de aniversário, lembretes e mais</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-pink-400" />
              </Link>

              {hasEva && (
              <Link
                href="/dashboard/config/eva"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 rounded-xl transition-colors border border-violet-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow">
                  <Icon name="sparkles" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-violet-900">Configurações da Eva</p>
                  <p className="text-xs text-violet-700">Personalidade, mensagens e tempos de follow-up</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-violet-400" />
              </Link>
              )}

              <Link
                href="/dashboard/config/anamnese"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 rounded-xl transition-colors border border-emerald-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow">
                  <Icon name="receipt" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">Ficha de Anamnese</p>
                  <p className="text-xs text-emerald-700">Título, cores, seções e perguntas personalizadas</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-emerald-400" />
              </Link>

              <Link
                href="/dashboard/config/lgpd"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-xl transition-colors border border-slate-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow">
                  <Icon name="shield" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Privacidade e LGPD</p>
                  <p className="text-xs text-slate-600">Exporte os dados da clínica em conformidade com a lei</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>

              <Link
                href="/dashboard/config/taxas"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 rounded-xl transition-colors border border-amber-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow">
                  <Icon name="dollarSign" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">Taxas de Pagamento</p>
                  <p className="text-xs text-amber-700">Configure taxas de cartão, Pix e formas de pagamento</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-amber-400" />
              </Link>

              <Link
                href="/dashboard/config/comissoes"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 rounded-xl transition-colors border border-teal-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow">
                  <Icon name="trendingUp" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-teal-900">Comissões</p>
                  <p className="text-xs text-teal-700">Defina o % de comissão de cada profissional</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-teal-400" />
              </Link>

              {hasNfse && (
                <Link
                  href="/dashboard/config/fiscal"
                  className="flex items-center gap-4 p-4 bg-gradient-to-br from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 rounded-xl transition-colors border border-orange-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow">
                    <Icon name="receipt" className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-orange-900">Nota Fiscal (NFS-e)</p>
                    <p className="text-xs text-orange-700">Cadastro fiscal da clínica e integração com a Focus NFe</p>
                  </div>
                  <Icon name="chevronRight" className="w-5 h-5 text-orange-400" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Links de ferramentas - apenas admin */}
        {isAdmin && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">🛠️ Ferramentas</h2>
            <div className="grid gap-3">
              <Link 
                href="/dashboard/config/tutorial"
                className="flex items-center gap-4 p-4 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors border border-violet-200"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Icon name="info" className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-violet-900">Central de Ajuda</p>
                  <p className="text-xs text-violet-600">Tutorial passo a passo de como usar o sistema</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-violet-400" />
              </Link>

              <Link
                href="/dashboard/config/importar"
                className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl transition-colors border border-blue-200"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow">
                  <Icon name="upload" className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">Importar Agendamentos</p>
                  <p className="text-xs text-blue-700">Importe histórico de agendamentos via planilha Excel</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-blue-400" />
              </Link>

              <Link 
                href="/dashboard/config/logs"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Icon name="activity" className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Logs do Sistema</p>
                  <p className="text-xs text-slate-500">Ver histórico de ações e erros</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>

              <Link 
                href="/dashboard/estoque"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icon name="box" className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Gestão de Estoque</p>
                  <p className="text-xs text-slate-500">Produtos, lotes e movimentações</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>

              <Link 
                href="/dashboard/documentos/templates"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Icon name="file" className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Templates de Documentos</p>
                  <p className="text-xs text-slate-500">Termos e contratos para assinatura</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
