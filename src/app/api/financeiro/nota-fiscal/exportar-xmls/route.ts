import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'

// Zip de todos os XMLs de notas autorizadas de um período — pra mandar direto pro
// contador. Só pega entradas que já têm nota_fiscal_xml_path (arquivada no nosso
// storage); notas autorizadas antes dessa feature existir não terão XML aqui.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData!.clinic_id
  const mes = req.nextUrl.searchParams.get('mes') // formato: YYYY-MM
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'parâmetro "mes" é obrigatório, formato YYYY-MM' }, { status: 400 })
  }

  const inicio = `${mes}-01`
  const [ano, mesNum] = mes.split('-').map(Number)
  const proximoMes = mesNum === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mesNum + 1).padStart(2, '0')}-01`

  const { data: entradas } = await supabase
    .from('entradas')
    .select('id, nota_fiscal_xml_path, nota_fiscal_numero, data_venda')
    .eq('clinic_id', clinicId)
    .eq('nota_fiscal_status', 'autorizada')
    .not('nota_fiscal_xml_path', 'is', null)
    .gte('data_venda', inicio)
    .lt('data_venda', proximoMes)

  if (!entradas || entradas.length === 0) {
    return NextResponse.json({ error: 'nenhum XML arquivado encontrado nesse período' }, { status: 404 })
  }

  const zip = new JSZip()
  let algumBaixado = false

  for (const entrada of entradas) {
    const { data: file } = await supabase.storage
      .from('notas-fiscais')
      .download(entrada.nota_fiscal_xml_path as string)
    if (!file) continue
    const nomeArquivo = `${entrada.nota_fiscal_numero || entrada.id}.xml`
    zip.file(nomeArquivo, await file.arrayBuffer())
    algumBaixado = true
  }

  if (!algumBaixado) {
    return NextResponse.json({ error: 'não consegui baixar nenhum XML desse período do storage' }, { status: 500 })
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="notas-fiscais-${mes}.zip"`,
    },
  })
}
