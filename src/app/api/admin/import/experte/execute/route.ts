import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { parseExperteZip, experteGender, experteStatusToAppointmentStatus, splitProcedimentos } from '@/lib/import/experte'
import { cleanText, parseNumber, parseDateOnly, parseDateTime, normalizePhone, normalizeCpf, normKey } from '@/lib/import/transforms'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CHUNK = 100

interface ExecuteOptions {
  clinicId: string
  label?: string
  importProcedures: boolean
  importPatients: boolean
  importAppointments: boolean
  professionalMap: Record<string, string> // nome na Experte -> users.id do Clinike (ou '' = não vincular)
  defaultProcedurePrice: number
}

interface Stat { entity: string; read: number; created: number; skipped: number; reasons: Record<string, number> }
function stat(entity: string): Stat { return { entity, read: 0, created: 0, skipped: 0, reasons: {} } }
function skip(s: Stat, reason: string) { s.skipped++; s.reasons[reason] = (s.reasons[reason] || 0) + 1 }

export async function POST(req: NextRequest) {
  const errors: string[] = []
  let batchId: string | null = null
  const admin = createServiceClient()

  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: 'Apenas super admin' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    const currentUserId = auth?.user?.id ?? null

    const form = await req.formData()
    const options = JSON.parse(String(form.get('options') || '{}')) as ExecuteOptions
    const { clinicId, professionalMap, defaultProcedurePrice } = options
    const file = form.get('file') as File | null

    if (!clinicId) return NextResponse.json({ error: 'clinicId obrigatório' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Envie o .zip exportado da Experte' }, { status: 400 })

    const { data: clinic } = await admin.from('clinics').select('id, name').eq('id', clinicId).maybeSingle()
    if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const files = await parseExperteZip(buffer)

    const { data: batch, error: batchErr } = await admin
      .from('import_batches')
      .insert({
        clinic_id: clinicId,
        source: 'experte',
        status: 'running',
        label: options.label || `Experte — ${new Date().toLocaleDateString('pt-BR')}`,
        mapping: { professionalMap },
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: `Falha ao criar lote: ${batchErr?.message}` }, { status: 500 })
    }
    batchId = batch.id

    const stats: Record<string, Stat> = {}

    // =====================================================================
    // 1. PROCEDIMENTOS (consultation_types.csv)
    // =====================================================================
    const procIdByKey = new Map<string, string>()
    const procPriceByKey = new Map<string, number>()
    {
      const s = stat('procedures')
      const { data: existing } = await admin.from('procedures').select('id, name').eq('clinic_id', clinicId)
      for (const e of existing || []) procIdByKey.set(normKey(e.name), e.id)

      const toCreate: Record<string, unknown>[] = []
      for (const r of files.consultationTypes) {
        s.read++
        const name = cleanText(r['Nome'])
        if (!name) { skip(s, 'sem nome'); continue }
        const key = normKey(name)
        const price = parseNumber(r['Valor'])
        if (price !== null && price > 0) procPriceByKey.set(key, price)

        if (procIdByKey.has(key)) { skip(s, 'já existia na clínica'); continue }
        const duration = parseNumber(r['Duração (minutos)'])
        toCreate.push({
          clinic_id: clinicId,
          name,
          price: price ?? defaultProcedurePrice ?? 0,
          duration_minutes: duration && duration > 0 ? Math.round(duration) : 30,
          active: cleanText(r['Status']) !== 'Inativo',
          category: 'Importado (Experte)',
          import_batch_id: batchId,
        })
      }

      if (options.importProcedures) {
        for (let i = 0; i < toCreate.length; i += CHUNK) {
          const { data, error } = await admin.from('procedures').insert(toCreate.slice(i, i + CHUNK)).select('id, name')
          if (error) errors.push(`Procedimentos: ${error.message.slice(0, 180)}`)
          else for (const d of data || []) { procIdByKey.set(normKey(d.name), d.id); s.created++ }
        }
      }
      stats.procedures = s
    }

    // =====================================================================
    // 2. PACIENTES (patients.csv)
    // =====================================================================
    const patientIdByName = new Map<string, string>() // primeiro cadastro encontrado com aquele nome
    const patientIdByPhone = new Map<string, string>()
    {
      const s = stat('patients')
      const { data: existing } = await admin.from('patients').select('id, name, phone, phone_original').eq('clinic_id', clinicId)
      for (const p of existing || []) {
        const nk = normKey(p.name)
        if (!patientIdByName.has(nk)) patientIdByName.set(nk, p.id)
        const a = normalizePhone(p.phone), b = normalizePhone(p.phone_original)
        if (a) patientIdByPhone.set(a, p.id)
        if (b) patientIdByPhone.set(b, p.id)
      }

      const pending: { name: string; phone: string | null; payload: Record<string, unknown> }[] = []
      for (const r of files.patients) {
        s.read++
        const name = cleanText(r['Nome'])
        if (!name) { skip(s, 'sem nome'); continue }
        const nk = normKey(name)

        const phone = normalizePhone(r['Contato Celular']) || normalizePhone(r['Contato Telefone'])
        if (phone && patientIdByPhone.has(phone)) { skip(s, 'já existia (telefone)'); continue }
        if (!phone && patientIdByName.has(nk)) { skip(s, 'já existia (nome)'); continue }

        const tags = cleanText(r['Status']) === 'Inativo' ? ['experte-inativo'] : []
        const notes = [
          cleanText(r['Observação']),
          cleanText(r['Notas']),
          cleanText(r['Origem']) && `Origem: ${cleanText(r['Origem'])}`,
          cleanText(r['Profissão']) && `Profissão: ${cleanText(r['Profissão'])}`,
          'Importado da Experte',
        ].filter(Boolean).join(' | ').slice(0, 1000)

        pending.push({
          name,
          phone,
          payload: {
            clinic_id: clinicId,
            name,
            gender: experteGender(r['Sexo']),
            birth_date: parseDateOnly(r['Data de Nascimento']),
            cpf: normalizeCpf(r['Documento CPF']),
            phone,
            phone_original: cleanText(r['Contato Celular']) || cleanText(r['Contato Telefone']),
            email: cleanText(r['Contato E-mail']),
            address: cleanText(r['Endereço Rua']),
            address_number: cleanText(r['Endereço Número']),
            neighborhood: cleanText(r['Endereço Bairro']),
            city: cleanText(r['Endereço Cidade']),
            state: cleanText(r['Endereço Estado']),
            zip_code: cleanText(r['Endereço CEP']),
            notes,
            tags,
            whatsapp_opt_in: false,
            import_batch_id: batchId,
          },
        })
      }

      if (options.importPatients) {
        for (let i = 0; i < pending.length; i += CHUNK) {
          const slice = pending.slice(i, i + CHUNK)
          const { data, error } = await admin.from('patients').insert(slice.map(x => x.payload)).select('id, name, phone')
          if (error) {
            errors.push(`Pacientes lote ${i}: ${error.message.slice(0, 180)}`)
          } else {
            (data || []).forEach(d => {
              const nk = normKey(d.name)
              if (!patientIdByName.has(nk)) patientIdByName.set(nk, d.id)
              if (d.phone) patientIdByPhone.set(d.phone, d.id)
              s.created++
            })
          }
        }
      }
      stats.patients = s
    }

    // =====================================================================
    // 3. AGENDAMENTOS (consultations.csv)
    // =====================================================================
    if (options.importAppointments) {
      const s = stat('appointments')
      const { data: existingAppts } = await admin
        .from('appointments').select('patient_id, start_time').eq('clinic_id', clinicId)
      const seen = new Set((existingAppts || []).map(a => `${a.patient_id}|${a.start_time}`))

      const now = new Date()
      const batchRows: Record<string, unknown>[] = []

      for (const r of files.consultations) {
        s.read++
        const patientName = cleanText(r['Nome Paciente'])
        const patientId = patientName ? patientIdByName.get(normKey(patientName)) : undefined
        if (!patientId) { skip(s, 'paciente não encontrado'); continue }

        const start = parseDateTime(r['Data'], r['Horário início'])
        if (!start) { skip(s, 'sem data válida'); continue }
        const end = parseDateTime(r['Data'], r['Horário fim']) || start

        const key = `${patientId}|${start}`
        if (seen.has(key)) { skip(s, 'duplicado'); continue }
        seen.add(key)

        const procNames = splitProcedimentos(r['Procedimentos'])
        const firstProc = procNames[0] || null
        const procedureId = firstProc ? procIdByKey.get(normKey(firstProc)) ?? null : null
        const price = firstProc ? procPriceByKey.get(normKey(firstProc)) ?? null : null

        const profName = cleanText(r['Nome Profissional'])
        const professionalId = (profName && professionalMap[profName]) || null

        const status = experteStatusToAppointmentStatus(cleanText(r['Status']), start, now)

        const notes = [
          procNames.length > 1 ? `Procedimentos: ${procNames.join(', ')}` : null,
          cleanText(r['Observações']),
          cleanText(r['Convênio']) && `Convênio: ${cleanText(r['Convênio'])}`,
          cleanText(r['Salas']) && `Sala: ${cleanText(r['Salas'])}`,
          profName && !professionalId ? `Profissional (Experte, não vinculado): ${profName}` : null,
          'Importado da Experte',
        ].filter(Boolean).join(' | ').slice(0, 1000)

        batchRows.push({
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          procedure_id: procedureId,
          start_time: start,
          end_time: end,
          status,
          price,
          valor_cobrado: status === 'completed' ? price : null,
          notes,
          import_batch_id: batchId,
        })
      }

      for (let i = 0; i < batchRows.length; i += CHUNK) {
        const { error } = await admin.from('appointments').insert(batchRows.slice(i, i + CHUNK))
        if (error) errors.push(`Agendamentos lote ${i}: ${error.message.slice(0, 180)}`)
        else s.created += Math.min(CHUNK, batchRows.length - i)
      }
      stats.appointments = s
    }

    await admin.from('import_batches').update({
      status: 'completed',
      stats,
      errors: errors.length ? errors.slice(0, 30) : null,
      completed_at: new Date().toISOString(),
    }).eq('id', batchId)

    return NextResponse.json({ ok: true, batchId, stats, errors: errors.slice(0, 30) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro na importação'
    if (batchId) {
      await admin.from('import_batches').update({
        status: 'failed',
        errors: [...errors, msg].slice(0, 30),
        completed_at: new Date().toISOString(),
      }).eq('id', batchId)
    }
    return NextResponse.json({ error: msg, batchId }, { status: 500 })
  }
}
