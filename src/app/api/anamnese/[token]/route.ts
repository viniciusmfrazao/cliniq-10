import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientIp, getUserAgent, getClientCountry } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { data: anamnese, error } = await getAdmin()
      .from('anamneses')
      .select('*, patients(name, email, phone, cpf, birth_date), clinics(name)')
      .eq('token', token)
      .maybeSingle()

    if (error || !anamnese) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    if (anamnese.status === 'expired') {
      return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
    }

    // Buscar configuração personalizada da clínica
    const { data: anamneseConfig } = await getAdmin()
      .from('anamnese_config')
      .select('*')
      .eq('clinic_id', anamnese.clinic_id)
      .maybeSingle()

    // Mark as viewed if pending
    if (anamnese.status === 'pending') {
      await getAdmin()
        .from('anamneses')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', anamnese.id)
    }

    return NextResponse.json({ ...anamnese, anamnese_config: anamneseConfig })
  } catch (error) {
    console.error('Error fetching anamnese:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await request.json()
    const { responses, signature } = body

    if (!responses || !signature) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // IP, User-Agent e país são extraídos dos headers (não do body)
    // — body é controlado pelo paciente/atacante e não tem valor
    // probatório. Esse trio compõe o conjunto probatório da
    // assinatura eletrônica simples (Lei 14.063/2020).
    const clientIp = getClientIp(request.headers)
    const userAgent = getUserAgent(request.headers)
    const country = getClientCountry(request.headers)

    // Find anamnese
    const { data: anamnese, error: findError } = await getAdmin()
      .from('anamneses')
      .select('id, status')
      .eq('token', token)
      .maybeSingle()

    if (findError || !anamnese) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }

    if (anamnese.status === 'completed') {
      return NextResponse.json({ error: 'Ficha já preenchida' }, { status: 400 })
    }

    if (anamnese.status === 'expired') {
      return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
    }

    // Update anamnese with responses
    const { error: updateError } = await getAdmin()
      .from('anamneses')
      .update({
        status: 'completed',
        responses,
        signature_data: signature,
        signature_ip: clientIp,
        signature_user_agent: userAgent,
        signature_country: country,
        completed_at: new Date().toISOString(),
      })
      .eq('id', anamnese.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving anamnese:', error)
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  }
}
