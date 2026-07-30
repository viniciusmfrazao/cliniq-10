import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientIp, getUserAgent, getClientCountry } from '@/lib/client-ip'
import { renderPlatformContract } from '@/lib/contract-template'
import { generateContractPdf } from '@/lib/contract-pdf'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { data: doc, error } = await getAdmin()
      .from('platform_contracts')
      .select('id, content, status, signed_at, plan_name, plan_price, clinics(name)')
      .eq('sign_token', token)
      .maybeSingle()

    if (error || !doc) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (doc.status === 'pending') {
      await getAdmin()
        .from('platform_contracts')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', doc.id)
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('Error fetching contract:', error)
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
    const { signature, signerName, signerCpf, signerRole, lat, lon } = body

    if (!signature) {
      return NextResponse.json({ error: 'Assinatura obrigatória' }, { status: 400 })
    }
    if (!signerName?.trim() || !signerCpf?.trim() || !signerRole?.trim()) {
      return NextResponse.json({ error: 'Nome, CPF e cargo do responsável são obrigatórios' }, { status: 400 })
    }

    const clientIp = getClientIp(request.headers)
    const userAgent = getUserAgent(request.headers)
    const country = getClientCountry(request.headers)

    const { data: doc, error: findError } = await getAdmin()
      .from('platform_contracts')
      .select('id, status, clinic_snapshot')
      .eq('sign_token', token)
      .maybeSingle()

    if (findError || !doc) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (doc.status === 'signed') {
      return NextResponse.json({ error: 'Contrato já assinado' }, { status: 400 })
    }
    if (doc.status === 'cancelled') {
      return NextResponse.json({ error: 'Contrato indisponível' }, { status: 400 })
    }

    // Re-renderiza o texto final já com os dados do signatário, para o
    // snapshot definitivo que fica gravado como prova do aceite.
    const snapshot = doc.clinic_snapshot as any
    const finalContent = renderPlatformContract(
      {
        name: snapshot?.name,
        cnpj: snapshot?.cnpj,
        clinic_phone: snapshot?.clinic_phone,
        plan: snapshot?.plan,
        plan_price: snapshot?.plan_price,
      },
      { signerName, signerCpf, signerRole }
    )

    const { error: updateError } = await getAdmin()
      .from('platform_contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        content: finalContent,
        signer_name: signerName,
        signer_cpf: signerCpf,
        signer_role: signerRole,
        signature_data: signature,
        signature_ip: clientIp,
        signature_user_agent: userAgent,
        signature_country: country,
        signature_lat: typeof lat === 'number' ? lat : null,
        signature_lon: typeof lon === 'number' ? lon : null,
      })
      .eq('id', doc.id)

    if (updateError) throw updateError

    // Gera o PDF final e persiste no Storage. Best-effort: se falhar, a
    // assinatura já foi gravada e não deve ser bloqueada por isso — o PDF
    // pode ser gerado depois via reprocessamento manual se necessário.
    try {
      const signedAtLabel = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const pdfBytes = await generateContractPdf({
        clinicName: snapshot?.name || '',
        content: finalContent,
        signerName,
        signerCpf,
        signerRole,
        signedAtLabel,
        signatureDataUrl: signature,
        signatureIp: clientIp,
        signatureUserAgent: userAgent,
        signatureCountry: country,
      })

      const clinicId = snapshot?.id
      const pdfPath = `${clinicId}/${doc.id}.pdf`

      const { error: uploadError } = await getAdmin()
        .storage
        .from('contracts')
        .upload(pdfPath, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true })

      if (!uploadError) {
        await getAdmin()
          .from('platform_contracts')
          .update({ pdf_path: pdfPath })
          .eq('id', doc.id)
      } else {
        console.error('[contratos/sign] erro ao subir PDF:', uploadError.message)
      }
    } catch (pdfErr) {
      console.error('[contratos/sign] erro ao gerar PDF:', pdfErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing contract:', error)
    return NextResponse.json({ error: 'Erro ao assinar' }, { status: 500 })
  }
}
