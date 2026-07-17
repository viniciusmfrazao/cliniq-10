import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fiscalConfigCompletaNfe, emitirNfeProduto, extrairErroFocus } from '@/lib/focus-nfe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData!.clinic_id
  const {
    entrada_id, destinatario_logradouro, destinatario_numero, destinatario_bairro,
    destinatario_municipio, destinatario_uf, destinatario_cep, destinatario_cpf,
  } = await req.json()
  if (!entrada_id) return NextResponse.json({ error: 'entrada_id é obrigatório' }, { status: 400 })

  const camposEndereco: Record<string, string | undefined> = {
    destinatario_logradouro, destinatario_numero, destinatario_bairro, destinatario_municipio, destinatario_uf,
  }
  const enderecoFaltando = Object.entries(camposEndereco).filter(([, v]) => !v).map(([k]) => k)
  if (enderecoFaltando.length > 0) {
    return NextResponse.json({ error: `Endereço do destinatário incompleto: ${enderecoFaltando.join(', ')}` }, { status: 400 })
  }

  const { data: clinic } = await supabase
    .from('clinics').select('settings').eq('id', clinicId).single()
  const activeModules: string[] = clinic?.settings?.active_modules || []
  if (!activeModules.includes('nfse')) {
    return NextResponse.json({ error: 'módulo de Nota Fiscal não está ativo para esta clínica' }, { status: 403 })
  }

  const { data: entrada } = await supabase
    .from('entradas')
    .select('id, clinic_id, valor_bruto, data_venda, paciente_id, paciente_nome, tipo_receita, nota_fiscal_status')
    .eq('id', entrada_id)
    .eq('clinic_id', clinicId)
    .single()

  if (!entrada) return NextResponse.json({ error: 'entrada não encontrada' }, { status: 404 })

  if (entrada.tipo_receita !== 'produto') {
    return NextResponse.json({ error: 'esta entrada não é de produto — emissão de NFe não se aplica' }, { status: 400 })
  }
  if (entrada.nota_fiscal_status === 'autorizada') {
    return NextResponse.json({ error: 'esta entrada já tem nota fiscal autorizada' }, { status: 400 })
  }
  if (entrada.nota_fiscal_status === 'processando') {
    return NextResponse.json({ error: 'já existe uma emissão em processamento para esta entrada' }, { status: 400 })
  }

  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  const check = fiscalConfigCompletaNfe(config)
  if (!check.ok) {
    return NextResponse.json({ error: `Configuração fiscal de NFe incompleta: ${check.faltando.join(', ')}` }, { status: 400 })
  }

  let destinatarioCpf: string | null = destinatario_cpf || null
  if (!destinatarioCpf && entrada.paciente_id) {
    const { data: paciente } = await supabase
      .from('patients').select('cpf').eq('id', entrada.paciente_id).maybeSingle()
    destinatarioCpf = paciente?.cpf || null
  }

  if (!destinatarioCpf) {
    return NextResponse.json({ error: 'CPF do comprador é obrigatório pra NFe — o paciente não tem CPF cadastrado e nenhum foi informado agora' }, { status: 400 })
  }

  const ref = `produto-${entrada.id}`

  try {
    const { httpStatus, data } = await emitirNfeProduto({
      config: config!,
      ref,
      valor: Number(entrada.valor_bruto),
      dataVenda: entrada.data_venda,
      destinatarioCpf,
      destinatarioNome: entrada.paciente_nome,
      destinatarioLogradouro: destinatario_logradouro,
      destinatarioNumero: destinatario_numero,
      destinatarioBairro: destinatario_bairro,
      destinatarioMunicipio: destinatario_municipio,
      destinatarioUf: destinatario_uf,
      destinatarioCep: destinatario_cep,
    })

    if (httpStatus === 201 || httpStatus === 202 || data?.status === 'processando_autorizacao') {
      await supabase.from('entradas').update({
        nota_fiscal_status: 'processando',
        nota_fiscal_ref: ref,
        nota_fiscal_erro: null,
      }).eq('id', entrada.id)
      return NextResponse.json({ success: true, status: 'processando' })
    }

    if (data?.codigo === 'nfe_autorizada') {
      await supabase.from('entradas').update({
        nota_fiscal_status: 'processando',
        nota_fiscal_ref: ref,
        nota_fiscal_erro: null,
      }).eq('id', entrada.id)
      return NextResponse.json({ success: true, status: 'processando' })
    }

    const mensagemErro = extrairErroFocus(data, httpStatus)
    await supabase.from('entradas').update({
      nota_fiscal_status: 'erro',
      nota_fiscal_erro: mensagemErro,
    }).eq('id', entrada.id)
    return NextResponse.json({ error: mensagemErro }, { status: 422 })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao emitir NFe'
    await supabase.from('entradas').update({
      nota_fiscal_status: 'erro',
      nota_fiscal_erro: mensagem,
    }).eq('id', entrada.id)
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
