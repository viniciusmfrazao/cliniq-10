import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fiscalConfigCompletaNfe } from '@/lib/focus-nfe'

export const dynamic = 'force-dynamic'

// IMPORTANTE: este endpoint valida se a clínica tem os campos fiscais de NFe (produto)
// completos e prontos, mas NÃO envia a nota pra Focus ainda — a emissão de NFe (modelo 55)
// é bem mais complexa que NFS-e (blocos de ICMS/PIS/COFINS por item, NCM, CFOP, unidade
// de medida, quantidade) e ainda não foi construída. Isso é intencional: é melhor dizer
// claramente "ainda não emite" do que arriscar montar um payload fiscal incorreto.
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
  const { entrada_id } = await req.json()
  if (!entrada_id) return NextResponse.json({ error: 'entrada_id é obrigatório' }, { status: 400 })

  const { data: entrada } = await supabase
    .from('entradas')
    .select('id, clinic_id, tipo_receita')
    .eq('id', entrada_id)
    .eq('clinic_id', clinicId)
    .single()

  if (!entrada) return NextResponse.json({ error: 'entrada não encontrada' }, { status: 404 })
  if (entrada.tipo_receita !== 'produto') {
    return NextResponse.json({ error: 'esta entrada não é de produto — emissão de NFe não se aplica' }, { status: 400 })
  }

  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  const check = fiscalConfigCompletaNfe(config)
  if (!check.ok) {
    return NextResponse.json({
      error: `Configuração fiscal de NFe incompleta: ${check.faltando.join(', ')}`,
      pronto: false,
    }, { status: 400 })
  }

  return NextResponse.json({
    pronto: true,
    aviso: 'Os campos fiscais de NFe estão completos, mas o envio real para a Focus (emissão de NF-e de produto) ainda não foi implementado.',
  }, { status: 501 })
}
