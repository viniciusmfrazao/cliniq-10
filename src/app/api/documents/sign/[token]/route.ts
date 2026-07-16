import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
import { NextResponse } from 'next/server'
import { getClientIp, getUserAgent, getClientCountry } from '@/lib/client-ip'

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { data: doc, error } = await getAdmin()
      .from('documents_sent')
      .select('*, patients(name), clinics(name, cnpj, clinic_phone), document_templates(questions), users!documents_sent_sent_by_fkey(name)')
      .eq('sign_token', token)
      .maybeSingle()

    if (error || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    // Mark as viewed if pending
    if (doc.status === 'pending') {
      await getAdmin()
        .from('documents_sent')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', doc.id)
    }

    // Se o documento foi enviado antes da feature de perguntas existir,
    // usa as perguntas do template como fallback
    const questions = (doc.questions && doc.questions.length > 0)
      ? doc.questions
      : (doc as any).document_templates?.questions || []

    return NextResponse.json({ ...doc, questions })
  } catch (error) {
    console.error('Error fetching document:', error)
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
    const { signature, question_answers } = body

    if (!signature) {
      return NextResponse.json({ error: 'Assinatura obrigatória' }, { status: 400 })
    }

    // IP, User-Agent e país extraídos dos headers (não do body) —
    // formam o conjunto probatório da assinatura eletrônica simples
    // (Lei 14.063/2020).
    const clientIp = getClientIp(request.headers)
    const userAgent = getUserAgent(request.headers)
    const country = getClientCountry(request.headers)

    // Find document
    const { data: doc, error: findError } = await getAdmin()
      .from('documents_sent')
      .select('id, status')
      .eq('sign_token', token)
      .maybeSingle()

    if (findError || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    if (doc.status === 'signed') {
      return NextResponse.json({ error: 'Documento já assinado' }, { status: 400 })
    }

    if (doc.status === 'expired' || doc.status === 'cancelled') {
      return NextResponse.json({ error: 'Documento indisponível' }, { status: 400 })
    }

    // Update document with signature
    const { error: updateError } = await getAdmin()
      .from('documents_sent')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data: signature,
        signature_ip: clientIp,
        signature_user_agent: userAgent,
        signature_country: country,
        question_answers: question_answers || {},
      })
      .eq('id', doc.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing document:', error)
    return NextResponse.json({ error: 'Erro ao assinar' }, { status: 500 })
  }
}
