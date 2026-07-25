import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import * as XLSX from 'xlsx'

export const maxDuration = 60

interface SourceRow {
  CancelBy?: string | null
  CancelReason?: string | null
  Canceled?: string | null
  CategoryDescription?: string | null
  Deleted?: string | null
  DentistName?: string | null
  MobilePhone?: number | string | null
  Notes?: string | null
  PatientName?: string | null
  Procedures?: string | null
  Status?: string | null
  date?: string | null
  fromTime?: string | null
  toTime?: string | null
}

function normalizePhone(raw: number | string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  return digits.length >= 11 ? digits.slice(-11) : digits
}

function parseDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const date = String(dateStr).slice(0, 10)
  const time = (timeStr || '09:00').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return `${date}T${time}:00-03:00`
}

function buildNotes(r: SourceRow, cancelledInfo: string | null): string {
  const parts = [
    r.CategoryDescription?.trim(),
    r.Procedures?.trim(),
    r.Notes?.trim(),
    cancelledInfo,
  ].filter((p): p is string => !!p && p.length > 0)
  const text = parts.join(' | ')
  return (text || 'Importado do sistema anterior').slice(0, 1000)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isClinicAdmin = !!currentUser && ['admin', 'super_admin'].includes(currentUser.role)
    const isPlatformSuperAdmin = await isSuperAdmin()

    if (!isClinicAdmin && !isPlatformSuperAdmin) {
      return NextResponse.json({ error: 'Apenas admins podem importar' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const clinicId = (formData.get('clinicId') as string || '').trim()
    const professionalId = (formData.get('professionalId') as string || '').trim()
    const defaultStatus = (formData.get('defaultStatus') as string) || 'completed'

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!clinicId || !professionalId) {
      return NextResponse.json({ error: 'clinicId e professionalId são obrigatórios' }, { status: 400 })
    }

    // Usa service role para escrever sem restrições de RLS (import administrativo)
    const admin = createServiceClient()

    // Valida que clínica e profissional existem e são compatíveis
    const { data: clinic } = await admin.from('clinics').select('id, name').eq('id', clinicId).single()
    if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

    const { data: professional } = await admin
      .from('users')
      .select('id, name, clinic_id')
      .eq('id', professionalId)
      .single()
    if (!professional || professional.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Profissional não encontrado nessa clínica' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null }) as SourceRow[]

    // Pacientes já existentes na clínica, indexados por telefone normalizado
    const { data: existingPatients } = await admin
      .from('patients')
      .select('id, phone, phone_original')
      .eq('clinic_id', clinicId)

    const phoneToId = new Map<string, string>()
    for (const p of existingPatients || []) {
      const n1 = normalizePhone(p.phone)
      const n2 = normalizePhone(p.phone_original)
      if (n1) phoneToId.set(n1, p.id)
      if (n2) phoneToId.set(n2, p.id)
    }

    // Agendamentos já existentes desse profissional (evita duplicar se rodar 2x)
    const { data: existingAppts } = await admin
      .from('appointments')
      .select('patient_id, start_time')
      .eq('clinic_id', clinicId)
      .eq('professional_id', professionalId)

    const existingApptKeys = new Set(
      (existingAppts || []).map(a => `${a.patient_id}|${a.start_time}`)
    )

    let skippedDeleted = 0
    let skippedNoDate = 0

    // Separa linhas válidas e coleta pacientes novos (dedupe por telefone)
    const newPatients = new Map<string, { name: string; phoneRaw: string }>()
    const validRows: { row: SourceRow; start: string; end: string; status: string; notes: string; ph: string | null }[] = []

    for (const r of rawRows) {
      if (r.Deleted) { skippedDeleted++; continue }

      const start = parseDateTime(r.date, r.fromTime)
      const end = parseDateTime(r.date, r.toTime) || start
      if (!start) { skippedNoDate++; continue }

      let status: string
      let cancelledInfo: string | null = null
      if (r.Canceled) {
        status = 'cancelled'
        cancelledInfo = ['Cancelado por: ' + (r.CancelBy || '?'), r.CancelReason?.trim()]
          .filter(Boolean).join(' - ')
      } else if (r.Status === 'MISSED') {
        status = 'no_show'
      } else if (r.Status === 'CONFIRMED') {
        status = new Date(start) < new Date() ? defaultStatus : 'confirmed'
      } else {
        status = new Date(start) < new Date() ? defaultStatus : 'scheduled'
      }

      const notes = buildNotes(r, cancelledInfo)
      const ph = normalizePhone(r.MobilePhone)
      const patientName = (r.PatientName || 'Paciente Importado').trim()

      if (ph && !phoneToId.has(ph)) {
        newPatients.set(ph, { name: patientName, phoneRaw: String(r.MobilePhone || '').trim() })
      }

      validRows.push({ row: r, start, end: end!, status, notes, ph })
    }

    // Cria pacientes novos em lote
    let patientsCreated = 0
    const errors: string[] = []
    const newPatientEntries = [...newPatients.entries()]
    for (let i = 0; i < newPatientEntries.length; i += 50) {
      const batch = newPatientEntries.slice(i, i + 50).map(([ph, info]) => ({
        clinic_id: clinicId,
        name: info.name,
        phone: ph,
        phone_original: info.phoneRaw,
        whatsapp_opt_in: false,
        notes: 'Importado do sistema anterior (Harmoniza)',
      }))
      const { data: created, error } = await admin.from('patients').insert(batch).select('id, phone')
      if (error) {
        errors.push(`Pacientes lote ${i}: ${error.message}`)
      } else {
        for (const p of created || []) {
          if (p.phone) phoneToId.set(p.phone, p.id)
          patientsCreated++
        }
      }
    }

    // Sem telefone: cria paciente individual por nome (fallback raro)
    let skippedNoPatient = 0

    const apptBatch: Record<string, unknown>[] = []
    let imported = 0
    let skippedDuplicate = 0

    const flush = async () => {
      if (apptBatch.length === 0) return
      const { error } = await admin.from('appointments').insert([...apptBatch])
      if (error) errors.push(`Agendamentos: ${error.message.slice(0, 200)}`)
      else imported += apptBatch.length
      apptBatch.length = 0
    }

    for (const v of validRows) {
      const patientId = v.ph ? phoneToId.get(v.ph) : null
      if (!patientId) { skippedNoPatient++; continue }

      const key = `${patientId}|${v.start}`
      if (existingApptKeys.has(key)) { skippedDuplicate++; continue }
      existingApptKeys.add(key)

      apptBatch.push({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        start_time: v.start,
        end_time: v.end,
        status: v.status,
        notes: v.notes,
      })

      if (apptBatch.length >= 100) await flush()
    }
    await flush()

    return NextResponse.json({
      ok: true,
      total: rawRows.length,
      imported,
      patientsCreated,
      skippedDeleted,
      skippedNoDate,
      skippedNoPatient,
      skippedDuplicate,
      errors: errors.slice(0, 10),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 })
  }
}
