import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import EntradasList from './entradas-list'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'

export default async function EntradasPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')

  // Carrega o mês atual por padrão
  const hoje = new Date()
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0)
  const ultimoDiaStr = `${ultimoDia.getFullYear()}-${String(ultimoDia.getMonth()+1).padStart(2,'0')}-${String(ultimoDia.getDate()).padStart(2,'0')}`

  const { data: entradas } = await supabase
    .from('entradas')
    .select('*')
    .eq('clinic_id', clinicId)
    .gte('data_venda', primeiroDia)
    .lte('data_venda', ultimoDiaStr)
    .order('data_venda', { ascending: false })

  const pacientes = await getAllPatients<{ id: string; name: string }>(
    supabase, clinicId ?? '', 'id, name'
  )

  const { data: procedimentos } = await supabase
    .from('procedures')
    .select('id, name, price')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('name')

  const { data: profissionais } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', clinicId)
    .in('role', ['doctor', 'esthetician', 'admin'])
    .order('name')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', clinicId)
    .single()

  const comissaoAtiva = !!clinic?.settings?.comissao_ativa
  const nfseAtivo = (clinic?.settings?.active_modules || []).includes('nfse')

  // Mapa de comissão por profissional, independente do filtro de role acima
  // (entradas podem referenciar qualquer papel clínico: dentista, enfermeiro, etc.)
  const { data: comissaoConfig } = comissaoAtiva
    ? await supabase
        .from('users')
        .select('id, recebe_comissao, comissao_percentual')
        .eq('clinic_id', clinicId)
    : { data: null }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
            <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Entradas</h1>
            <p className="text-slate-500">
              {scope === 'own' ? 'Suas receitas' : 'Gerencie as receitas da clínica'}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/financeiro/entradas/nova"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
        >
          <Icon name="plus" className="w-5 h-5" />
          Nova Entrada
        </Link>
      </div>

      <EntradasList
        entradas={entradas || []}
        pacientes={pacientes || []}
        procedimentos={procedimentos || []}
        profissionais={profissionais || []}
        clinicId={clinicId ?? ''}
        comissaoAtiva={comissaoAtiva}
        comissaoConfig={comissaoConfig || []}
        nfseAtivo={nfseAtivo}
      />
    </div>
  )
}
