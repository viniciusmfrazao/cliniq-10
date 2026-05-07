import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'

/**
 * POST /api/admin/storage/setup
 *
 * Cria (ou atualiza) os buckets de Storage usados pelo Cliniq de forma
 * idempotente — admin/manager-only. Mesmo trabalho do
 * `supabase-storage-buckets.sql`, mas sem precisar mexer em SQL.
 *
 * Cria 2 buckets:
 *   - medical-attachments: fotos do prontuário (privado, 20MB)
 *   - whatsapp-media: mídias do chat WhatsApp (privado, 40MB)
 *
 * Não cria as RLS policies — quem rodar o SQL completo ganha as policies.
 * Sem as policies, só o service_role consegue ler/escrever (que é o que
 * webhook receiver e cron usam de qualquer jeito). O frontend usa signed
 * URLs gerados pelo backend, então também funciona.
 */

type BucketSpec = {
  id: string
  fileSizeLimit: number
  allowedMimeTypes: string[]
}

const BUCKETS: BucketSpec[] = [
  {
    id: 'medical-attachments',
    fileSizeLimit: 20 * 1024 * 1024, // 20MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ],
  },
  {
    id: 'whatsapp-media',
    fileSizeLimit: 40 * 1024 * 1024, // 40MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'audio/wav',
      'video/mp4',
      'video/3gpp',
      'video/quicktime',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
]

export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem configurar storage' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()
  const results: Array<{
    bucket: string
    action: 'created' | 'updated' | 'unchanged' | 'error'
    error?: string
  }> = []

  for (const spec of BUCKETS) {
    const { data: existing, error: getErr } = await svc.storage.getBucket(spec.id)

    if (getErr && !/not found|does not exist/i.test(getErr.message)) {
      results.push({ bucket: spec.id, action: 'error', error: getErr.message })
      continue
    }

    if (!existing) {
      const { error: createErr } = await svc.storage.createBucket(spec.id, {
        public: false,
        fileSizeLimit: spec.fileSizeLimit,
        allowedMimeTypes: spec.allowedMimeTypes,
      })
      if (createErr) {
        results.push({ bucket: spec.id, action: 'error', error: createErr.message })
      } else {
        results.push({ bucket: spec.id, action: 'created' })
      }
      continue
    }

    // Já existe — atualiza configs pra garantir tamanho + mimes corretos
    const { error: updateErr } = await svc.storage.updateBucket(spec.id, {
      public: false,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    })
    if (updateErr) {
      results.push({ bucket: spec.id, action: 'error', error: updateErr.message })
    } else {
      results.push({ bucket: spec.id, action: 'updated' })
    }
  }

  const hasError = results.some((r) => r.action === 'error')
  return NextResponse.json(
    {
      ok: !hasError,
      buckets: results,
      note:
        'Buckets sao privados. Frontend acessa via signed URLs gerados no backend. ' +
        'Pra abrir leitura/escrita autenticada direto do client, rode o ' +
        'supabase-storage-buckets.sql (cria policies de RLS).',
    },
    { status: hasError ? 500 : 200 },
  )
}

export async function GET() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem ver storage' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()
  const results: Array<{
    bucket: string
    exists: boolean
    public?: boolean
    fileSizeLimit?: number | null
    allowedMimeTypes?: string[] | null
    error?: string
  }> = []

  for (const spec of BUCKETS) {
    const { data, error } = await svc.storage.getBucket(spec.id)
    if (error) {
      const isMissing = /not found|does not exist/i.test(error.message)
      results.push({
        bucket: spec.id,
        exists: false,
        error: isMissing ? undefined : error.message,
      })
    } else if (data) {
      results.push({
        bucket: spec.id,
        exists: true,
        public: data.public,
        fileSizeLimit: data.file_size_limit,
        allowedMimeTypes: data.allowed_mime_types,
      })
    }
  }

  return NextResponse.json({ ok: true, buckets: results })
}
