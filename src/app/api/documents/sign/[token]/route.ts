import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { data: doc, error } = await supabaseAdmin
      .from('documents_sent')
      .select('*, patients(name), clinics(name)')
      .eq('sign_token', params.token)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    // Mark as viewed if pending
    if (doc.status === 'pending') {
      await supabaseAdmin
        .from('documents_sent')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', doc.id)
    }

    return NextResponse.json(doc)
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
    const body = await request.json()
    const { signature, ip } = body

    if (!signature) {
      return NextResponse.json({ error: 'Assinatura obrigatória' }, { status: 400 })
    }

    // Find document
    const { data: doc, error: findError } = await supabaseAdmin
      .from('documents_sent')
      .select('id, status')
      .eq('sign_token', params.token)
      .single()

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
    const { error: updateError } = await supabaseAdmin
      .from('documents_sent')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data: signature,
        signature_ip: ip || null,
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
