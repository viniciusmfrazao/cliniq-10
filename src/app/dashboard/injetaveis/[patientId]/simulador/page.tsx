import { createClient, getCachedUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SimulatorClient from './simulator-client'

export const dynamic = 'force-dynamic'

export default async function SimuladorPage({ params }: { params: { patientId: string } }) {
  const { patientId } = params
  const supabase = await createClient()
  const user = await getCachedUser()
  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, id')
    .eq('id', user!.id)
    .maybeSingle()

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, phone, gender')
    .eq('id', patientId)
    .maybeSingle()

  if (!patient) notFound()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, current_stock, unit, cost_price, sale_price')
    .eq('clinic_id', userData?.clinic_id)
    .eq('is_active', true)
    .eq('category', 'injetavel')
    .order('name')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/injetaveis/${patientId}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Voltar para o mapa de {patient.name}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Simulador de Harmonização</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monte o plano de tratamento, visualize custo, simetria e zonas de risco — e simule o resultado na foto do paciente
        </p>
      </div>

      <SimulatorClient
        patientId={patientId}
        clinicId={userData?.clinic_id ?? ''}
        professionalId={userData?.id ?? ''}
        patientGender={patient.gender === 'M' ? 'male' : 'female'}
        products={products || []}
      />
    </div>
  )
}
