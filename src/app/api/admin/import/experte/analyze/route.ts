import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { parseExperteZip, analyzeExperte } from '@/lib/import/experte'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: 'Apenas super admin' }, { status: 403 })
    }

    const form = await req.formData()
    const clinicId = String(form.get('clinicId') || '').trim()
    const file = form.get('file') as File | null

    if (!clinicId) return NextResponse.json({ error: 'clinicId obrigatório' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Envie o .zip exportado da Experte' }, { status: 400 })

    const admin = createServiceClient()
    const { data: clinic } = await admin.from('clinics').select('id, name').eq('id', clinicId).maybeSingle()
    if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const files = await parseExperteZip(buffer)
    const analysis = analyzeExperte(files)

    const [{ data: users }, { data: procs }, { data: batches }] = await Promise.all([
      admin.from('users').select('id, name, role, active').eq('clinic_id', clinicId).order('name'),
      admin.from('procedures').select('id, name, price').eq('clinic_id', clinicId).order('name'),
      admin.from('import_batches')
        .select('id, label, status, stats, created_at, source')
        .eq('clinic_id', clinicId).order('created_at', { ascending: false }).limit(10),
    ])

    const [{ count: patientCount }, { count: apptCount }] = await Promise.all([
      admin.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      admin.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    ])

    return NextResponse.json({
      ok: true,
      clinic,
      analysis,
      target: {
        users: users || [],
        procedures: procs || [],
        existingPatients: patientCount || 0,
        existingAppointments: apptCount || 0,
        batches: batches || [],
      },
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao analisar o arquivo' },
      { status: 500 }
    )
  }
}
