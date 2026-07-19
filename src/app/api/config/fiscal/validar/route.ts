import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validarFormatoFiscal, consultarMunicipioFocus, consultarCodigoTributarioFocus, focusToken } from '@/lib/focus-nfe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData!.clinic_id

  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({ ok: false, erros: ['Nenhuma configuração fiscal salva ainda'], avisos: [] })
  }

  // 1. Validação de formato — não depende de rede, é instantânea
  const errosFormato = validarFormatoFiscal(config)

  const avisos: string[] = []
  const erros: string[] = [...errosFormato]

  // 2. Validação contra a base da Focus — só roda se o formato básico já está ok,
  //    a clínica realmente emite NFS-e, e existe token pro ambiente selecionado.
  if (config.emite_nfse !== false && errosFormato.length === 0 && focusToken(config)) {
    try {
      const { httpStatus: statusMun, data: dataMun } = await consultarMunicipioFocus(config, config.codigo_municipio_ibge!)
      if (statusMun === 404) {
        erros.push(`Código de município ${config.codigo_municipio_ibge} não encontrado na base da Focus`)
      } else if (statusMun >= 400) {
        avisos.push('Não foi possível confirmar o município na Focus (verifique manualmente)')
      } else if (dataMun?.nome) {
        avisos.push(`Município confirmado: ${dataMun.nome}${dataMun.uf ? ' - ' + dataMun.uf : ''}`)
      }

      const { httpStatus: statusCod, data: dataCod } = await consultarCodigoTributarioFocus(
        config, config.codigo_municipio_ibge!, config.codigo_tributacao_nacional_iss!
      )
      if (statusCod === 404) {
        erros.push(`Código de tributação "${config.codigo_tributacao_nacional_iss}" não encontrado para esse município — confira o código correto`)
      } else if (statusCod >= 400) {
        avisos.push('Não foi possível confirmar o código de tributação na Focus (verifique manualmente)')
      } else if (dataCod?.descricao) {
        avisos.push(`Código de tributação confirmado: ${dataCod.descricao}`)
      }
    } catch {
      avisos.push('Não foi possível conectar com a Focus para validar automaticamente — confira os dados manualmente')
    }
  } else if (config.emite_nfse !== false && !focusToken(config)) {
    avisos.push('Sem token cadastrado para o ambiente atual — só foi possível validar o formato dos campos, não a base da Focus')
  }

  return NextResponse.json({ ok: erros.length === 0, erros, avisos })
}
