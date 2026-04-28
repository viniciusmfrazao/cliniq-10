import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/client-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { data: anamnese, error } = await supabaseAdmin
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

    // Mark as viewed if pending
    if (anamnese.status === 'pending') {
      await supabaseAdmin
        .from('anamneses')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', anamnese.id)
    }

    return NextResponse.json(anamnese)
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

    // IP é extraído do header (não do body) — body é controlado pelo
    // paciente/atacante e não tem valor probatório.
    const clientIp = getClientIp(request.headers)

    // Find anamnese
    const { data: anamnese, error: findError } = await supabaseAdmin
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
    const { error: updateError } = await supabaseAdmin
      .from('anamneses')
      .update({
        status: 'completed',
        responses,
        signature_data: signature,
        signature_ip: clientIp,
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
