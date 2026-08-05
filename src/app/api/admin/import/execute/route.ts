import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { PRESETS } from '@/lib/import/presets/clinicorp'
import { parseWorkbooks, analyze, fileByKey } from '@/lib/import/engine'
import {
  resolveColumns, mapRow, cleanText, parseNumber, parseFlag,
  parseDateTime, parseDateOnly, normalizePhone, splitProcedures, normKey,
} from '@/lib/import/transforms'
import type { EntityKey, EntityStat, ImportOptions, RawRow } from '@/lib/import/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CHUNK = 100

function stat(entity: EntityKey): EntityStat {
  return { entity, read: 0, created: 0, skipped: 0, reasons: {} }
}
function skip(s: EntityStat, reason: string) {
  s.skipped++
  s.reasons[reason] = (s.reasons[reason] || 0) + 1
}

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
    const optionsRaw = String(form.get('options') || '{}')
    const options = JSON.parse(optionsRaw) as ImportOptions
    const { clinicId, presetId, reconciliation, entities, skipDeleted, defaultProcedurePrice } = options

    if (!clinicId) return NextResponse.json({ error: 'clinicId obrigatório' }, { status: 400 })
    const preset = PRESETS[presetId as keyof typeof PRESETS]
    if (!preset) return NextResponse.json({ error: 'Preset desconhecido' }, { status: 400 })

    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const { data: clinic } = await admin
      .from('clinics').select('id, name').eq('id', clinicId).maybeSingle()
    if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

    const buffers = await Promise.all(
      files.map(async f => ({ name: f.name, buffer: await f.arrayBuffer() }))
    )
    const parsed = parseWorkbooks(buffers, preset)
    const analysis = analyze(parsed, preset)

    // ---- Abre o lote ----
    const { data: batch, error: batchErr } = await admin
      .from('import_batches')
      .insert({
        clinic_id: clinicId,
        source: presetId,
        status: 'running',
        label: options.label || `Importação ${preset.label}`,
        mapping: { reconciliation, columnOverrides: options.columnOverrides || {}, entities },
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: `Falha ao criar lote: ${batchErr?.message}` }, { status: 500 })
    }
    batchId = batch.id

    const wants = (e: EntityKey) => entities.includes(e)
    const stats: Record<string, EntityStat> = {}

    // =====================================================================
    // 1. PROCEDIMENTOS
    // =====================================================================
    const procIdByKey = new Map<string, string>()
    const procPriceByKey = new Map<string, number>()
    for (const p of analysis.procedures) {
      if (p.price !== null) procPriceByKey.set(normKey(p.name), p.price)
    }

    {
      const s = stat('procedures')
      const { data: existing } = await admin
        .from('procedures').select('id, name').eq('clinic_id', clinicId)
      for (const e of existing || []) procIdByKey.set(normKey(e.name), e.id)

      const toCreate: Record<string, unknown>[] = []
      for (const p of analysis.procedures) {
        s.read++
        const decision = reconciliation.procedures?.[p.name] ?? 'new'
        const key = normKey(p.name)

        if (decision === 'skip') { skip(s, 'ignorado pelo operador'); continue }
        if (decision !== 'new') { procIdByKey.set(key, decision); skip(s, 'vinculado a existente'); continue }
        if (procIdByKey.has(key)) { skip(s, 'já existia na clínica'); continue }

        toCreate.push({
          clinic_id: clinicId,
          name: p.name,
          price: p.price ?? defaultProcedurePrice ?? 0,
          duration_minutes: 60,
          active: true,
          category: 'Importado',
          import_batch_id: batchId,
        })
      }

      if (wants('procedures')) {
        for (let i = 0; i < toCreate.length; i += CHUNK) {
          const { data, error } = await admin
            .from('procedures').insert(toCreate.slice(i, i + CHUNK)).select('id, name')
          if (error) errors.push(`Procedimentos: ${error.message.slice(0, 180)}`)
          else for (const d of data || []) { procIdByKey.set(normKey(d.name), d.id); s.created++ }
        }
      }
      stats.procedures = s
    }

    // =====================================================================
    // 2. PACIENTES
    // =====================================================================
    const patientIdBySourceId = new Map<string, string>()
    const patientIdByPhone = new Map<string, string>()

    {
      const s = stat('patients')
      const pf = fileByKey(parsed, 'Patient')
      const fields = preset.fields.patients || []
      const resolved = pf
        ? resolveColumns(pf.headers, fields, options.columnOverrides?.patients || {})
        : {}

      const { data: existing } = await admin
        .from('patients').select('id, phone, phone_original').eq('clinic_id', clinicId)
      for (const p of existing || []) {
        const a = normalizePhone(p.phone), b = normalizePhone(p.phone_original)
        if (a) patientIdByPhone.set(a, p.id)
        if (b) patientIdByPhone.set(b, p.id)
      }

      const pending: { sourceId: string; payload: Record<string, unknown>; phone: string | null }[] = []

      for (const r of pf?.rows || []) {
        s.read++
        const sourceId = String(r['id'] ?? '')
        const type = cleanText(r['Type'])
        if (type && type.toUpperCase() !== 'PATIENT') { skip(s, 'não é paciente'); continue }

        const mapped = mapRow(r, fields, resolved)
        const name = cleanText(mapped.name) || cleanText(r['Name'])
        if (!name) { skip(s, 'sem nome'); continue }

        const phone = (mapped.phone as string) || null
        if (phone && patientIdByPhone.has(phone)) {
          patientIdBySourceId.set(sourceId, patientIdByPhone.get(phone)!)
          skip(s, 'já existia (telefone)')
          continue
        }

        // Campos sem destino direto viram observação
        const extras = [
          cleanText(r['HowDidMeet']) && `Como conheceu: ${cleanText(r['HowDidMeet'])}`,
          cleanText(r['IndicationSource']) && `Indicado por: ${cleanText(r['IndicationSource'])}`,
          cleanText(r['CivilStatus']) && `Estado civil: ${cleanText(r['CivilStatus'])}`,
          cleanText(r['Education']) && `Escolaridade: ${cleanText(r['Education'])}`,
          cleanText(r['NickName']) && `Apelido: ${cleanText(r['NickName'])}`,
          cleanText(r['DocumentId']) && `RG: ${cleanText(r['DocumentId'])}`,
        ].filter(Boolean).join(' | ')

        pending.push({
          sourceId,
          phone,
          payload: {
            ...mapped,
            name,
            clinic_id: clinicId,
            phone_original: cleanText(r['MobilePhone']),
            whatsapp_opt_in: false,
            notes: [extras, `Importado do ${preset.label}`].filter(Boolean).join(' | ').slice(0, 1000),
            import_batch_id: batchId,
          },
        })
      }

      if (wants('patients')) {
        for (let i = 0; i < pending.length; i += CHUNK) {
          const slice = pending.slice(i, i + CHUNK)
          const { data, error } = await admin
            .from('patients').insert(slice.map(x => x.payload)).select('id, phone')
          if (error) {
            errors.push(`Pacientes lote ${i}: ${error.message.slice(0, 180)}`)
          } else {
            // insert preserva a ordem de entrada
            ;(data || []).forEach((d, idx) => {
              const src = slice[idx]
              if (src) patientIdBySourceId.set(src.sourceId, d.id)
              if (d.phone) patientIdByPhone.set(d.phone, d.id)
              s.created++
            })
          }
        }
      }
      stats.patients = s
    }

    // =====================================================================
    // 3. AGENDAMENTOS
    // =====================================================================
    if (wants('appointments')) {
      const s = stat('appointments')
      const af = fileByKey(parsed, 'Appointment')

      const { data: existingAppts } = await admin
        .from('appointments').select('patient_id, start_time').eq('clinic_id', clinicId)
      const seen = new Set((existingAppts || []).map(a => `${a.patient_id}|${a.start_time}`))

      const batchRows: Record<string, unknown>[] = []
      const now = new Date()

      for (const r of af?.rows || []) {
        s.read++
        if (skipDeleted && parseFlag(r['Deleted'])) { skip(s, 'deletado na origem'); continue }

        const patientId = patientIdBySourceId.get(String(r['PatientId'] ?? ''))
          || (normalizePhone(r['MobilePhone']) ? patientIdByPhone.get(normalizePhone(r['MobilePhone'])!) : undefined)
        if (!patientId) { skip(s, 'paciente não encontrado'); continue }

        const start = parseDateTime(r['date'], r['fromTime'])
        if (!start) { skip(s, 'sem data válida'); continue }
        const end = parseDateTime(r['date'], r['toTime']) || start

        const professionalId = reconciliation.professionals?.[String(r['DentistId'] ?? '')] || ''
        if (!professionalId) { skip(s, 'profissional não vinculado'); continue }

        const key = `${patientId}|${start}`
        if (seen.has(key)) { skip(s, 'duplicado'); continue }
        seen.add(key)

        const procNames = splitProcedures(r['Procedures'])
        const procedureId = procNames.length ? procIdByKey.get(normKey(procNames[0])) ?? null : null

        let status: string
        const cancelled = parseFlag(r['Canceled'])
        const srcStatus = (cleanText(r['Status']) || '').toUpperCase()
        if (cancelled) status = 'cancelled'
        else if (srcStatus === 'MISSED') status = 'no_show'
        else if (srcStatus === 'CHECKOUT') status = 'completed'
        else if (srcStatus === 'CONFIRMED') status = new Date(start) < now ? 'completed' : 'confirmed'
        else status = new Date(start) < now ? 'completed' : 'scheduled'

        const notes = [
          cleanText(r['CategoryDescription']),
          procNames.length > 1 ? `Também: ${procNames.slice(1).join(', ')}` : null,
          cleanText(r['Notes']),
          cancelled ? `Cancelado por ${cleanText(r['CancelBy']) || '?'}` : null,
          parseFlag(r['Deleted']) ? 'Marcado como excluído na origem' : null,
        ].filter(Boolean).join(' | ').slice(0, 1000)

        batchRows.push({
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          procedure_id: procedureId,
          start_time: start,
          end_time: end,
          status,
          notes: notes || `Importado do ${preset.label}`,
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

    // =====================================================================
    // 4. ORÇAMENTOS
    // =====================================================================
    if (wants('orcamentos')) {
      const s = stat('orcamentos')
      const bf = fileByKey(parsed, 'Budgets')

      // Agrupa linhas por BudgetId
      const groups = new Map<string, RawRow[]>()
      for (const r of bf?.rows || []) {
        if (parseFlag(r['Deleted'])) continue
        const id = String(r['BudgetId'] ?? '')
        if (!id) continue
        groups.set(id, [...(groups.get(id) || []), r])
      }

      for (const [budgetId, rows] of groups) {
        s.read++
        const head = rows[0]
        const patientId = patientIdBySourceId.get(String(head['PatientId'] ?? ''))
        if (!patientId) { skip(s, 'paciente não encontrado'); continue }

        let status = 'pendente'
        if (parseFlag(head['BudgetApproved'])) status = 'aprovado'
        else if (parseFlag(head['NotApproved'])) status = 'recusado'

        // Consolida itens por nome de procedimento
        const items = new Map<string, { descricao: string; qtd: number; valor: number }>()
        for (const r of rows) {
          const nome = cleanText(r['ProcedureName']) || 'Procedimento'
          const valor = parseNumber(r['ProcedureFinalAmount']) ?? parseNumber(r['ProcedureAmount']) ?? 0
          const k = normKey(nome)
          const cur = items.get(k) || { descricao: nome, qtd: 0, valor }
          cur.qtd++
          if (valor > 0) cur.valor = valor
          items.set(k, cur)
        }

        const titulo = items.size === 1
          ? [...items.values()][0].descricao
          : `Orçamento importado (${items.size} procedimentos)`

        const obs = [
          cleanText(head['BudgetsNotes']),
          cleanText(head['Notes']),
          cleanText(head['BudgetRejectedReason']) && `Motivo da recusa: ${cleanText(head['BudgetRejectedReason'])}`,
          cleanText(head['BudgetPaymentForm']) && `Pagamento: ${cleanText(head['BudgetPaymentForm'])}`,
          `Origem: ${preset.label} #${budgetId}`,
        ].filter(Boolean).join(' | ').slice(0, 1000)

        const { data: orc, error: orcErr } = await admin
          .from('orcamentos')
          .insert({
            clinic_id: clinicId,
            patient_id: patientId,
            titulo,
            status,
            observacoes: obs,
            created_at: parseDateTime(head['BudgetsCreateDate'], null) || undefined,
            import_batch_id: batchId,
          })
          .select('id')
          .single()

        if (orcErr || !orc) { errors.push(`Orçamento ${budgetId}: ${orcErr?.message.slice(0, 120)}`); skip(s, 'erro ao gravar'); continue }

        const itemRows = [...items.values()].map(it => ({
          orcamento_id: orc.id,
          descricao: it.descricao,
          quantidade: it.qtd,
          valor_unitario: it.valor,
        }))
        const { error: itErr } = await admin.from('orcamento_itens').insert(itemRows)
        if (itErr) errors.push(`Itens do orçamento ${budgetId}: ${itErr.message.slice(0, 120)}`)

        s.created++
      }
      stats.orcamentos = s
    }

    // =====================================================================
    // 5. ENTRADAS (financeiro)
    // =====================================================================
    if (wants('entradas')) {
      const s = stat('entradas')
      const hf = fileByKey(parsed, 'PaymentHeader')
      const itf = fileByKey(parsed, 'PaymentItem')
      const bf = fileByKey(parsed, 'Budgets')

      // TreatmentId (header) == BudgetId (orçamento): dá o nome do procedimento
      const procNameByBudget = new Map<string, string>()
      for (const r of bf?.rows || []) {
        const id = String(r['BudgetId'] ?? '')
        const nome = cleanText(r['ProcedureName'])
        if (id && nome && !procNameByBudget.has(id)) procNameByBudget.set(id, nome)
      }

      // Parcelas agrupadas por header
      const itemsByHeader = new Map<string, RawRow[]>()
      for (const r of itf?.rows || []) {
        if (parseFlag(r['Canceled'])) continue
        const h = String(r['PaymentHeaderId'] ?? '')
        if (!h) continue
        itemsByHeader.set(h, [...(itemsByHeader.get(h) || []), r])
      }

      const rows: Record<string, unknown>[] = []

      for (const r of hf?.rows || []) {
        s.read++
        const headerId = String(r['id'] ?? '')
        const items = itemsByHeader.get(headerId) || []
        if (!items.length) { skip(s, 'sem parcelas válidas'); continue }

        const patientId = patientIdBySourceId.get(String(r['PatientId'] ?? ''))
        if (!patientId) { skip(s, 'paciente não encontrado'); continue }

        const valorBruto = items.reduce((acc, it) => acc + (parseNumber(it['Amount']) || 0), 0)
        if (valorBruto <= 0) { skip(s, 'valor zero'); continue }

        const dataVenda = parseDateOnly(r['PaymentDate']) || parseDateOnly(items[0]['PaymentDate'])
        if (!dataVenda) { skip(s, 'sem data'); continue }

        // Forma de pagamento predominante entre as parcelas
        const formCount = new Map<string, number>()
        for (const it of items) {
          const raw = cleanText(it['Type']) || cleanText(it['PaymentForm_CharacteristicId']) || 'OTHER'
          formCount.set(raw, (formCount.get(raw) || 0) + 1)
        }
        const topRaw = [...formCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
        const forma = reconciliation.paymentForms?.[topRaw]
          || preset.valueMaps.paymentForm[topRaw]
          || 'outro'

        const nParcelas = parseNumber(r['InstallmentsCount']) || items.length || 1
        const budgetId = String(r['TreatmentId'] ?? '')
        const procName = procNameByBudget.get(budgetId) || null
        const procId = procName ? procIdByKey.get(normKey(procName)) ?? null : null

        rows.push({
          clinic_id: clinicId,
          data_venda: dataVenda,
          paciente_id: patientId,
          procedimento_id: procId,
          procedimento_nome: procName,
          forma_pagamento: forma,
          valor_bruto: valorBruto,
          taxa_percentual: 0,
          valor_taxa: 0,
          valor_liquido: valorBruto,
          n_parcelas: Math.max(1, Math.round(nParcelas)),
          tipo_receita: 'servico',
          observacoes: [
            cleanText(r['Description']),
            `Importado do ${preset.label} #${headerId}`,
          ].filter(Boolean).join(' | ').slice(0, 1000),
          import_batch_id: batchId,
        })
      }

      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await admin.from('entradas').insert(rows.slice(i, i + CHUNK))
        if (error) errors.push(`Entradas lote ${i}: ${error.message.slice(0, 180)}`)
        else s.created += Math.min(CHUNK, rows.length - i)
      }
      stats.entradas = s
    }

    // ---- Fecha o lote ----
    await admin.from('import_batches').update({
      status: errors.length ? 'completed' : 'completed',
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
