import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappImage } from '@/lib/whatsapp'

// ROTA TEMPORÁRIA — uso único pra corrigir documentos já enviados sem o
// anexo (bug corrigido em 20/07/2026). Remover após uso.
const ONEOFF_SECRET = '-GrwOYmVE5XSdjUsae-dARcBOGeL8KScdOa-l9P8IqQ'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== ONEOFF_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const documentoId = req.nextUrl.searchParams.get('documentoId')
  if (!documentoId) {
    return NextResponse.json({ ok: false, error: 'documentoId obrigatorio' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: doc, error: errDoc } = await svc
    .from('documents_sent')
    .select('*, document_templates(name, image_url), patients(id, name, phone)')
    .eq('id', documentoId)
    .maybeSingle()

  if (errDoc || !doc) {
    return NextResponse.json({ ok: false, error: 'documento_nao_encontrado' }, { status: 404 })
  }

  const patient = doc.patients as any
  const template = doc.document_templates as any
  const phone = (patient?.phone || '').trim()
  if (!phone) return NextResponse.json({ ok: false, error: 'paciente_sem_telefone' }, { status: 400 })

  const fileUrl = (template?.image_url || '') as string
  if (!fileUrl) return NextResponse.json({ ok: false, error: 'template_sem_anexo' }, { status: 400 })
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf')

  const result = await sendWhatsappImage({
    clinicId: doc.clinic_id,
    phone,
    media: fileUrl,
    mimetype: isPdf ? 'application/pdf' : 'image/jpeg',
    caption: '',
    fileName: isPdf ? `${template?.name || 'documento'}.pdf` : undefined,
    purpose: 'automation',
  })

  return NextResponse.json({ ok: result.ok, result, patient: patient?.name, phone })
}
