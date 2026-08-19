import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { expertePreset } from '@/lib/import/presets/experte'
import { parseWorkbooks, fileByKey } from '@/lib/import/engine'
import { analyzeExperte, splitProceduresComma } from '@/lib/import/experte-engine'
import {
  cleanText, parseNumber, parseDateOnly, parseDateTime,
  parseGender, normalizePhone, normalizeCpf, normKey,
} from '@/lib/import/transforms'
import type { EntityKey, EntityStat, Reconciliation, RawRow } from '@/lib/import/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CHUNK = 100
type Admin = ReturnType<typeof createServiceClient>

interface ExperteOptions {
  clinicId: string
  reconciliation: Reconciliation
  entities: string[]
  includeRescheduled: boolean
  defaultProcedurePrice: number
  label?: string
}

function stat(entity: EntityKey): EntityStat {
  return { entity, read: 0, created: 0, skipped: 0, reasons: {} }
}
function skip(s: EntityStat, reason: string) {
  s.skipped++
  s.reasons[reason] = (s.reasons[reason] || 0) + 1
}

/** Reduz a mensagem crua do Postgres a um motivo curto e legivel pro card de resultado. */
function summarizeDbError(msg: string): string {
  if (/uq_patients_phone_clinic/i.test(msg)) return 'telefone ja usado por outro paciente'
  if (/duplicate key value violates unique constraint/i.test(msg)) return 'registro duplicado (conflito de dados)'
  if (/violates foreign key constraint/i.test(msg)) return 'referencia invalida (fk)'
  if (/violates check constraint/i.test(msg)) return 'valor fora do permitido'
  if (/violates not-null constraint/i.test(msg)) return 'campo obrigatorio ausente'
  return msg.slice(0, 100)
}

/**
 * Insere em lotes de CHUNK, mas com rede de seguranca: uma unica linha
 * problematica num INSERT multi-linha aborta a instrucao inteira no Postgres
 * (nao so a linha ruim). Se o lote falhar, tenta de novo linha a linha pra
 * nao perder as validas junto com a problematica.
 */
async function insertResilient(
  admin: Admin,
  table: string,
  rows: Record<string, unknown>[],
  s: EntityStat,
  errors: string[],
  select?: string
): Promise<Record<string, unknown>[]> {
  const created: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const query = admin.from(table).insert(slice)
    const { data, error } = select ? await query.select(select) : await query

    if (!error) {
      s.created += slice.length
      if (data) created.push(...(data as unknown as Record<string, unknown>[]))
      continue
    }

    // Lote falhou - tenta linha a linha para isolar so a(s) problematica(s).
    for (const row of slice) {
      const q2 = admin.from(table).insert(row)
      const { data: d2, error: e2 } = select ? await q2.select(select) : await q2
      if (e2) {
        skip(s, summarizeDbError(e2.message))
        if (errors.length < 30) errors.push(`${table}: ${e2.message.slice(0, 180)}`)
      } else {
        s.created++
        if (d2) created.push(...(Array.isArray(d2) ? (d2 as unknown as Record<string, unknown>[]) : [d2 as unknown as Record<string, unknown>]))
      }
    }
  }

  return created
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
    const options = JSON.parse(optionsRaw) as ExperteOptions
    const { clinicId, reconciliation, entities, includeRescheduled, defaultProcedurePrice } = options

    if (!clinicId) return NextResponse.json({ error: 'clinicId obrigatorio' }, { status: 400 })

    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const { data: clinic } = await admin
      .from('clinics').select('id, name').eq('id', clinicId).maybeSingle()
    if (!clinic) return NextResponse.json({ error: 'Clinica nao encontrada' }, { status: 400 })

    const buffers = await Promise.all(
      files.map(async f => ({ name: f.name, buffer: await f.arrayBuffer() }))
    )
    const parsed = parseWorkbooks(buffers, expertePreset)
    const analysis = analyzeExperte(parsed)

    // ---- Abre o lote ----
    const { data: batch, error: batchErr } = await admin
      .from('import_batches')
      .insert({
        clinic_id: clinicId,
        source: 'experte',
        status: 'running',
        label: options.label || 'Importação Experte',
        mapping: { reconciliation, entities },
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: `Falha ao criar lote: ${batchErr?.message}` }, { status: 500 })
    }
    batchId = batch.id

    const wants = (e: string) => entities.includes(e)
    const stats: Record<string, EntityStat> = {}

    // =====================================================================
    // 1. PROCEDIMENTOS
    // =====================================================================
    const procIdByKey = new Map<string, string>()

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
        if (procIdByKey.has(key)) { skip(s, 'ja existia na clinica'); continue }

        toCreate.push({
          clinic_id: clinicId,
          name: p.name,
          price: p.price ?? defaultProcedurePrice ?? 0,
          duration_minutes: p.durationMinutes ?? 60,
          active: p.active,
          category: 'Importado',
          import_batch_id: batchId,
        })
      }

      if (wants('procedures')) {
        const created = await insertResilient(admin, 'procedures', toCreate, s, errors, 'id, name')
        for (const d of created) procIdByKey.set(normKey(d.name as string), d.id as string)
      }
      stats.procedures = s
    }

    // =====================================================================
    // 2. PACIENTES (sem id na origem - vinculo por nome)
    // =====================================================================
    const patientIdByName = new Map<string, string>()
    const patientIdByPhone = new Map<string, string>()

    {
      const s = stat('patients')
      const pf = fileByKey(parsed, 'Patients')

      const { data: existing } = await admin
        .from('patients').select('id, name, phone, phone_original').eq('clinic_id', clinicId)
      for (const p of existing || []) {
        const a = normalizePhone(p.phone), b = normalizePhone(p.phone_original)
        if (a) patientIdByPhone.set(a, p.id)
        if (b) patientIdByPhone.set(b, p.id)
        patientIdByName.set(normKey(p.name), p.id)
      }

      const pending: { nameKey: string; payload: Record<string, unknown>; phone: string | null }[] = []
      // Telefones ja reservados nesta propria leva (ainda sem id, entao nao
      // estao em patientIdByPhone) - evita que duas linhas do MESMO arquivo
      // com o mesmo telefone caiam no mesmo INSERT multi-linha e derrubem o
      // lote inteiro por violacao de uq_patients_phone_clinic.
      const phonesInThisFile = new Set<string>()

      for (const r of pf?.rows || []) {
        s.read++
        const name = cleanText(r['Nome'])
        if (!name) { skip(s, 'sem nome'); continue }
        const nameKey = normKey(name)

        const phone = normalizePhone(r['Contato Celular']) || normalizePhone(r['Contato Telefone'])

        if (phone && patientIdByPhone.has(phone)) {
          patientIdByName.set(nameKey, patientIdByPhone.get(phone)!)
          skip(s, 'ja existia (telefone)')
          continue
        }
        if (phone && phonesInThisFile.has(phone)) {
          // Provavelmente duas pessoas dividindo o mesmo celular (comum:
          // familiares) - mantem a primeira, a segunda fica sem patient_id
          // e seus agendamentos aparecem como "paciente nao encontrado"
          // (visivel e corrigivel manualmente, em vez de mesclar duas
          // pessoas reais sob um unico cadastro).
          skip(s, 'telefone duplicado no arquivo (outra pessoa)')
          continue
        }
        if (phone) phonesInThisFile.add(phone)

        const extras = [
          cleanText(r['Profissão']) && `Profissão: ${cleanText(r['Profissão'])}`,
          cleanText(r['Estado Civil']) && `Estado civil: ${cleanText(r['Estado Civil'])}`,
          cleanText(r['Origem']) && `Origem: ${cleanText(r['Origem'])}`,
          cleanText(r['Documento RG']) && `RG: ${cleanText(r['Documento RG'])}`,
          cleanText(r['Observação']),
          (cleanText(r['Status']) || '').toLowerCase() === 'inativo' ? 'Status na origem: Inativo' : null,
        ].filter(Boolean).join(' | ')

        pending.push({
          nameKey,
          phone,
          payload: {
            clinic_id: clinicId,
            name,
            phone,
            phone_original: cleanText(r['Contato Celular']),
            email: cleanText(r['Contato E-mail']),
            cpf: normalizeCpf(r['Documento CPF']),
            birth_date: parseDateOnly(r['Data de Nascimento']),
            gender: parseGender(r['Sexo']),
            address: cleanText(r['Endereço Rua']),
            address_number: cleanText(r['Endereço Número']),
            neighborhood: cleanText(r['Endereço Bairro']),
            city: cleanText(r['Endereço Cidade']),
            state: cleanText(r['Endereço Estado']),
            zip_code: cleanText(r['Endereço CEP']),
            whatsapp_opt_in: false,
            notes: [extras, 'Importado do Experte'].filter(Boolean).join(' | ').slice(0, 1000),
            import_batch_id: batchId,
          },
        })
      }

      if (wants('patients')) {
        // insertResilient nao devolve o nameKey de origem no retry linha a
        // linha (o select so traz colunas da tabela) - mapeia por telefone
        // quando existir, e faz fallback linha a linha proprio quando nao
        // (paciente sem telefone) pra nunca perder o vinculo nome -> id.
        const withPhone = pending.filter(p => p.phone)
        const withoutPhone = pending.filter(p => !p.phone)

        const createdWithPhone = await insertResilient(
          admin, 'patients', withPhone.map(x => x.payload), s, errors, 'id, name, phone'
        )
        const byPhone = new Map(withPhone.map(x => [x.phone as string, x.nameKey]))
        for (const d of createdWithPhone) {
          const phone = d.phone as string | null
          const nameKey = phone ? byPhone.get(phone) : undefined
          if (nameKey) patientIdByName.set(nameKey, d.id as string)
          if (phone) patientIdByPhone.set(phone, d.id as string)
        }

        // Sem telefone: nada pra usar como chave de correlacao segura no
        // retry linha a linha, entao insere realmente uma linha por vez.
        for (const x of withoutPhone) {
          const { data, error } = await admin.from('patients').insert(x.payload).select('id').single()
          if (error) {
            skip(s, summarizeDbError(error.message))
            if (errors.length < 30) errors.push(`patients: ${error.message.slice(0, 180)}`)
          } else {
            s.created++
            patientIdByName.set(x.nameKey, data.id)
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
      const af = fileByKey(parsed, 'Consultations')

      const { data: existingAppts } = await admin
        .from('appointments').select('patient_id, start_time').eq('clinic_id', clinicId)
      const seen = new Set((existingAppts || []).map(a => `${a.patient_id}|${a.start_time}`))

      const batchRows: Record<string, unknown>[] = []
      const now = new Date()

      for (const r of af?.rows || []) {
        s.read++
        const srcStatus = cleanText(r['Status']) || ''

        if (srcStatus === 'Remarcado' && !includeRescheduled) { skip(s, 'remarcado (ignorado)'); continue }

        const patientName = cleanText(r['Nome Paciente'])
        const patientId = patientName ? patientIdByName.get(normKey(patientName)) : undefined
        if (!patientId) { skip(s, 'paciente nao encontrado'); continue }

        const professionalName = cleanText(r['Nome Profissional']) || ''
        const professionalId = reconciliation.professionals?.[professionalName] || ''
        if (!professionalId) { skip(s, 'profissional nao vinculado'); continue }

        const start = parseDateTime(r['Data'], r['Horário início'])
        if (!start) { skip(s, 'sem data valida'); continue }
        const end = parseDateTime(r['Data'], r['Horário fim']) || start

        const key = `${patientId}|${start}`
        if (seen.has(key)) { skip(s, 'duplicado'); continue }
        seen.add(key)

        const procNames = splitProceduresComma(r['Procedimentos'])
        const procedureId = procNames.length ? procIdByKey.get(normKey(procNames[0])) ?? null : null

        let status: string
        if (srcStatus === 'Concluído') status = 'completed'
        else if (srcStatus === 'Confirmado') status = 'confirmed'
        else if (srcStatus === 'Cancelado') status = 'cancelled'
        else if (srcStatus === 'Não compareceu') status = 'no_show'
        else if (srcStatus === 'Remarcado') status = 'rescheduling'
        else status = new Date(start) < now ? 'completed' : 'scheduled'

        const notes = [
          cleanText(r['Observações']),
          procNames.length > 1 ? `Também: ${procNames.slice(1).join(', ')}` : null,
          cleanText(r['Convênio']) && `Convênio: ${cleanText(r['Convênio'])}`,
        ].filter(Boolean).join(' | ').slice(0, 1000)

        batchRows.push({
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          procedure_id: procedureId,
          start_time: start,
          end_time: end,
          status,
          notes: notes || 'Importado do Experte',
          import_batch_id: batchId,
        })
      }

      await insertResilient(admin, 'appointments', batchRows, s, errors)
      stats.appointments = s
    }

    // =====================================================================
    // 4. ENTRADAS (financeiro)
    // =====================================================================
    if (wants('entradas')) {
      const s = stat('entradas')
      const pcf = fileByKey(parsed, 'FinancialParcels')
      const rows: Record<string, unknown>[] = []

      for (const r of (pcf?.rows || []) as RawRow[]) {
        s.read++
        const categoria = cleanText(r['Categoria']) || ''
        if (categoria.toLowerCase() === 'transferências') { skip(s, 'saldo inicial / transferencia'); continue }

        const valorBruto = parseNumber(r['Valor bruto']) || 0
        if (valorBruto <= 0) { skip(s, 'valor zero'); continue }

        const dataVenda = parseDateOnly(r['Vencimento']) || parseDateOnly(r['Execução']) || parseDateOnly(r['Compensação'])
        if (!dataVenda) { skip(s, 'sem data'); continue }

        const contato = cleanText(r['Contato'])
        const patientId = contato ? patientIdByName.get(normKey(contato)) ?? null : null

        const rawForm = cleanText(r['Método de pagamento']) || 'DESCONHECIDO'
        const forma = reconciliation.paymentForms?.[rawForm] || expertePreset.valueMaps.paymentForm[rawForm] || 'outro'

        const parcelaStr = cleanText(r['Número da parcela']) || '1/1'
        const totalParcelas = Number(parcelaStr.split('/')[1]) || 1

        const valorLiquido = parseNumber(r['Valor líquido']) ?? valorBruto
        const tipoReceita = categoria.toLowerCase().includes('produto') ? 'produto' : 'servico'

        rows.push({
          clinic_id: clinicId,
          data_venda: dataVenda,
          paciente_id: patientId,
          paciente_nome: contato,
          forma_pagamento: forma,
          valor_bruto: valorBruto,
          taxa_percentual: 0,
          valor_taxa: 0,
          valor_liquido: valorLiquido,
          n_parcelas: Math.max(1, totalParcelas),
          tipo_receita: tipoReceita,
          observacoes: [
            cleanText(r['Descrição Título']),
            'Importado do Experte',
          ].filter(Boolean).join(' | ').slice(0, 1000),
          import_batch_id: batchId,
        })
      }

      await insertResilient(admin, 'entradas', rows, s, errors)
      stats.entradas = s
    }

    // ---- Fecha o lote ----
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
