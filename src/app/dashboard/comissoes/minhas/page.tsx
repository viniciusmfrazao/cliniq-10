import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import MinhasComissoesView from './minhas-comissoes-view'

export const dynamic = 'force-dynamic'

export default async function MinhasComissoesPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, name, clinic_id, role, professional_role, recebe_comissao, comissao_percentual')
    .eq('id', user.id)
    .single()

  if (!me) redirect('/dashboard')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', me.clinic_id)
    .single()

  const comissaoAtiva = !!clinic?.settings?.comissao_ativa
  const comissaoBase: 'bruto' | 'liquido' = clinic?.settings?.comissao_base === 'liquido' ? 'liquido' : 'bruto'

  // Independente de role/scope de quem está logado, essa tela é sempre "minhas
  // comissões" — filtra explicitamente pelo próprio id, não confia só na RLS
  // (um admin visitando essa tela não deveria ver as comissões de todo mundo aqui).
  const hoje = new Date()
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDiaData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  const ultimoDia = `${ultimoDiaData.getFullYear()}-${String(ultimoDiaData.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaData.getDate()).padStart(2, '0')}`

  const { data: entradas } = await supabase
    .from('entradas')
    .select('id, data_venda, paciente_nome, procedimento_nome, valor_bruto, valor_liquido, comissao_paga, comissao_paga_em')
    .eq('clinic_id', me.clinic_id)
    .eq('profissional_id', me.id)
    .gte('data_venda', primeiroDia)
    .lte('data_venda', ultimoDia)
    .order('data_venda', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Minhas Comissões</h1>
        <p className="text-slate-500 mt-1">
          Os atendimentos que geraram comissão pra você, e quanto vai receber de cada um.
        </p>
      </div>

      {!comissaoAtiva ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">
            Essa clínica ainda não ativou o sistema de comissões. Fale com a administração se tiver dúvidas.
          </p>
        </div>
      ) : !me.recebe_comissao || me.comissao_percentual == null ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">
            Você ainda não tem um percentual de comissão configurado. Fale com a administração da clínica.
          </p>
        </div>
      ) : (
        <MinhasComissoesView
          entradasIniciais={entradas || []}
          percentual={me.comissao_percentual}
          comissaoBase={comissaoBase}
          clinicId={me.clinic_id}
        />
      )}
    </div>
  )
}
