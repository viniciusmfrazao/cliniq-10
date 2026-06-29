import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface InputRow {
  data: string
  horario: string
  cliente: string
  servico: string
  preco: number
  observacao?: string
}

function parseDate(s: string): string {
  const part = s.includes(',') ? s.split(', ')[1] : s
  const [d, m, y] = part.trim().split('/')
  return `${y}-${m}-${d}`
}

function parseTimes(horario: string, date: string): [string, string] {
  const parts = horario.split(' às ')
  const start = parts[0].trim()
  const end = parts[1]?.trim() ?? start
  return [`${date}T${start}:00-03:00`, `${date}T${end}:00-03:00`]
}

export async function POST(req: NextRequest) {
  try {
    const { clinicId, professionalId, rows } = await req.json() as {
      clinicId: string
      professionalId: string
      rows: InputRow[]
    }

    if (!clinicId || !professionalId || !rows?.length) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Buscar pacientes e procedimentos sem RLS
    const [{ data: patients }, { data: procedures }] = await Promise.all([
      supabase.from('patients').select('id, name').eq('clinic_id', clinicId),
      supabase.from('procedures').select('id, name').eq('clinic_id', clinicId),
    ])

    const patientMap = new Map<string, string>()
    for (const p of patients ?? []) patientMap.set(p.name.trim().toLowerCase(), p.id)

    const procedureMap = new Map<string, string>()
    for (const p of procedures ?? []) procedureMap.set(p.name.trim().toLowerCase(), p.id)

    const toInsert: object[] = []
    const skipped: { name: string; reason: string }[] = []

    for (const row of rows) {
      const clientName = row.cliente.trim()
      const serviceName = row.servico.split(',')[0].trim()

      const patientId = patientMap.get(clientName.toLowerCase())
      if (!patientId) {
        skipped.push({ name: clientName, reason: 'paciente não encontrado' })
        continue
      }

      const dateStr = parseDate(row.data)
      const [startTime, endTime] = parseTimes(row.horario, dateStr)
      const procedureId = procedureMap.get(serviceName.toLowerCase()) ?? null

      toInsert.push({
        id: crypto.randomUUID(),
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        procedure_id: procedureId,
        start_time: startTime,
        end_time: endTime,
        status: 'completed',
        notes: row.observacao ?? null,
        price: row.preco,
        valor_cobrado: row.preco,
      })
    }

    // Inserir em lotes de 50
    let inserted = 0
    const BATCH = 50
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const { error } = await supabase.from('appointments').insert(toInsert.slice(i, i + BATCH))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      inserted += Math.min(BATCH, toInsert.length - i)
    }

    return NextResponse.json({ inserted, skipped, total: rows.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 })
  }
}
