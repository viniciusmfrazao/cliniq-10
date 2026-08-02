import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientIp, getUserAgent, getClientCountry } from '@/lib/client-ip'
import { computeSignatureHash } from '@/lib/signature-hash'

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

    // Ficha de modelo customizado (builder livre) — busca o template e os
    // campos em vez da config do modelo fixo.
    if (anamnese.template_id) {
      const { data: template } = await getAdmin()
        .from('anamnese_templates')
        .select('*')
        .eq('id', anamnese.template_id)
        .maybeSingle()

      const { data: templateFields } = await getAdmin()
        .from('anamnese_template_fields')
        .select('*')
        .eq('template_id', anamnese.template_id)
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      // Mark as viewed if pending
      if (anamnese.status === 'pending') {
        await getAdmin()
          .from('anamneses')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', anamnese.id)
      }

      return NextResponse.json({ ...anamnese, template, template_fields: templateFields || [] })
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
    const { responses, signature, identificacao, lat, lon } = body

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
      .select('id, status, patient_id, clinic_id, template_id')
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

    // Campos obrigatórios do modelo customizado (builder livre), se for o caso
    if (anamnese.template_id) {
      const { data: obrigatorios } = await getAdmin()
        .from('anamnese_template_fields')
        .select('id, label')
        .eq('template_id', anamnese.template_id)
        .eq('obrigatorio', true)
        .eq('ativo', true)

      const faltando = (obrigatorios || []).filter((f) => {
        const v = responses?.[f.id as string]
        return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
      })
      if (faltando.length > 0) {
        return NextResponse.json(
          { error: `Preencha: ${faltando.map((f) => f.label).join(', ')}` },
          { status: 400 },
        )
      }
    }

    // Validar e atualizar cadastro do paciente com dados de identificação
    if (anamnese.patient_id) {
      const { data: pat } = await getAdmin()
        .from('patients')
        .select('cpf, birth_date, phone, email')
        .eq('id', anamnese.patient_id)
        .single()

      // Campos de identificação obrigatórios conforme config da clínica (ou
      // do modelo customizado, se a ficha usa um) — mesma regra do front:
      // exigidos só quando o paciente ainda não tem.
      let camposIdAtivos: string[] = ['data_nascimento', 'cpf']
      if (anamnese.template_id) {
        const { data: tmpl } = await getAdmin()
          .from('anamnese_templates')
          .select('campos_identificacao')
          .eq('id', anamnese.template_id)
          .maybeSingle()
        if (tmpl?.campos_identificacao?.length) camposIdAtivos = tmpl.campos_identificacao
      } else {
        const { data: anamneseConfig } = await getAdmin()
          .from('anamnese_config')
          .select('campos_identificacao')
          .eq('clinic_id', anamnese.clinic_id)
          .maybeSingle()
        if (anamneseConfig?.campos_identificacao?.length) camposIdAtivos = anamneseConfig.campos_identificacao
      }

      const cpfDigits = (identificacao?.cpf || '').replace(/\D/g, '')
      if (camposIdAtivos.includes('cpf') && !pat?.cpf && cpfDigits.length !== 11) {
        return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })
      }

      const isValidIsoDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
      if (camposIdAtivos.includes('data_nascimento') && !pat?.birth_date && !isValidIsoDate(identificacao?.birth_date)) {
        return NextResponse.json({ error: 'Data de nascimento é obrigatória' }, { status: 400 })
      }

      const updates: Record<string, string> = {}
      // CPF: só salva se o paciente ainda não tem
      if (!pat?.cpf && identificacao?.cpf?.trim()) {
        updates.cpf = identificacao.cpf.trim()
      }
      // Data de nascimento: sempre atualiza se o paciente enviou um valor
      if (identificacao?.birth_date) {
        updates.birth_date = identificacao.birth_date
      }
      // Telefone: só salva se o paciente ainda não tem
      if (!pat?.phone && identificacao?.phone?.trim()) {
        updates.phone = identificacao.phone.trim()
      }
      // Email: só salva se o paciente ainda não tem
      if (!pat?.email && identificacao?.email?.trim()) {
        updates.email = identificacao.email.trim()
      }

      if (Object.keys(updates).length > 0) {
        await getAdmin()
          .from('patients')
          .update(updates)
          .eq('id', anamnese.patient_id)
      }
    }

    // Hash de integridade: qualquer alteração posterior nas respostas ou na
    // imagem da assinatura muda o hash — prova complementar ao IP/UA/país.
    const signatureHash = computeSignatureHash([JSON.stringify(responses), signature])

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
        signature_hash: signatureHash,
        signature_lat: typeof lat === 'number' ? lat : null,
        signature_lon: typeof lon === 'number' ? lon : null,
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
