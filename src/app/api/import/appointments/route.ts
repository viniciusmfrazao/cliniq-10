import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const maxDuration = 60

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length >= 11) return digits.slice(-11)
  if (digits.length >= 10) return digits
  return digits
}

function parseDateTime(dateStr: string | null, timeStr: string | null): string | null {
  try {
    if (!dateStr) return null
    const date = String(dateStr).slice(0, 10)
    const time = timeStr || '09:00'
    return `${date}T${time}:00-03:00`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: currentUser } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Apenas admins podem importar' }, { status: 403 })
    }

    const clinicId = currentUser.clinic_id
    const formData = await req.formData()
    const file = formData.get('file') as File
    const skipProfessionals = (formData.get('skipProfessionals') as string || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const defaultStatus = formData.get('defaultStatus') as string || 'completed'
    const fictitiousName = formData.get('fictitiousName') as string || ''

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    // Ler Excel
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[]

    // Buscar profissionais da clínica
    const { data: professionals } = await supabase
      .from('users')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('active', true)

    // Criar ou buscar profissional fictício se necessário
    let fictitiousId: string | null = null
    if (fictitiousName) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('clinic_id', clinicId)
        .ilike('name', fictitiousName)
        .single()

      if (existing) {
        fictitiousId = existing.id
      } else {
        const { data: created } = await supabase
          .from('users')
          .insert({
            clinic_id: clinicId,
            name: fictitiousName,
            email: `${fictitiousName.toLowerCase().replace(/\s+/g, '.')}.ficticio@clinike.internal`,
            role: 'esthetician',
            active: false,
          })
          .select('id')
          .single()
        fictitiousId = created?.id || null
      }
    }

    // Mapear nome de profissional → id
    function findProfId(dentistName: string): string | null {
      const key = dentistName.toLowerCase()
      for (const prof of professionals || []) {
        const profKey = prof.name.toLowerCase().replace(/^dra?\.\s+/, '')
        if (key.includes(profKey) || profKey.includes(key)) return prof.id
      }
      // Se fictitiousName configurado e não achou, usa fictício
      if (fictitiousId) return fictitiousId
      return null
    }

    // Carregar pacientes existentes por telefone
    const { data: existingPatients } = await supabase
      .from('patients')
      .select('id, phone, phone_original')
      .eq('clinic_id', clinicId)

    const phoneToId = new Map<string, string>()
    for (const p of existingPatients || []) {
      if (p.phone) phoneToId.set(p.phone, p.id)
      if (p.phone_original) phoneToId.set(p.phone_original, p.id)
    }

    // Processar linhas
    let imported = 0, skipped = 0, patientsCreated = 0
    const errors: string[] = []

    // Agrupar pacientes únicos para criar em lote
    const newPatients = new Map<string, { name: string; phoneRaw: string }>()
    const validRows: Record<string, any>[] = []

    for (const r of rawRows) {
      // Ignorar deletados/cancelados
      if (r.Deleted || r.Canceled) { skipped++; continue }

      const dentistName = (r.DentistName || '').trim()
      const dentistKey = dentistName.toLowerCase()

      // Ignorar profissionais da lista de skip
      if (skipProfessionals.some(s => dentistKey.includes(s))) { skipped++; continue }

      const ph = normalizePhone(r.MobilePhone)
      const patientName = (r.PatientName || 'Paciente Importado').trim()

      if (ph && !phoneToId.has(ph)) {
        newPatients.set(ph, { name: patientName, phoneRaw: String(r.MobilePhone || '').trim() })
      }
      validRows.push(r)
    }

    // Criar pacientes novos em lote de 50
    const newPatientEntries = [...newPatients.entries()]
    for (let i = 0; i < newPatientEntries.length; i += 50) {
      const batch = newPatientEntries.slice(i, i + 50).map(([ph, info]) => ({
        clinic_id: clinicId,
        name: info.name,
        phone: ph,
        phone_original: info.phoneRaw,
        whatsapp_opt_in: false,
        notes: 'Importado do sistema anterior',
      }))
      const { data: created, error } = await supabase
        .from('patients')
        .insert(batch)
        .select('id, phone')
      if (error) {
        errors.push(`Pacientes lote ${i}: ${error.message}`)
      } else {
        for (const p of created || []) {
          if (p.phone) phoneToId.set(p.phone, p.id)
          patientsCreated++
        }
      }
    }

    // Criar agendamentos em lote de 100
    const apptBatch: Record<string, any>[] = []

    const flush = async () => {
      if (apptBatch.length === 0) return
      const { error } = await supabase.from('appointments').insert([...apptBatch])
      if (error) errors.push(`Agendamentos: ${error.message.slice(0, 200)}`)
      else imported += apptBatch.length
      apptBatch.length = 0
    }

    for (const r of validRows) {
      const dentistName = (r.DentistName || '').trim()
      const profId = findProfId(dentistName)
      if (!profId) { skipped++; continue }

      const ph = normalizePhone(r.MobilePhone)
      const patientId = ph ? phoneToId.get(ph) : null
      if (!patientId) { skipped++; continue }

      const start = parseDateTime(r.date, r.fromTime)
      const end = parseDateTime(r.date, r.toTime) || start
      if (!start) { skipped++; continue }

      const notes = (r.Notes || 'Importado do sistema anterior').trim().slice(0, 500)

      apptBatch.push({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: profId,
        start_time: start,
        end_time: end,
        status: defaultStatus,
        notes: notes || 'Importado do sistema anterior',
      })

      if (apptBatch.length >= 100) await flush()
    }
    await flush()

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      patientsCreated,
      errors: errors.slice(0, 10),
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
