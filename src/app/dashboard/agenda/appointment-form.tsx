'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import PatientSearch from '@/components/ui/PatientSearch'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import PackageSessionScheduler, { type ScheduledSessionRow } from '@/components/packages/PackageSessionScheduler'
import { todayBR } from '@/lib/datetime'
import { parseSupabaseError } from '@/lib/error-messages'


type Patient = { id: string; name: string; phone?: string | null }
type Procedure = { id: string; name: string; duration_minutes: number; price: number; professional_ids?: string[] | null }
type Professional = { id: string; name: string }
type Room = { id: string; name: string }

type Props = {
  clinicId: string
  patients: Patient[]
  procedures: Procedure[]
  professionals: Professional[]
  rooms: Room[]
  defaultPatientId?: string
  defaultDate?: string
  defaultTime?: string
  defaultProfessionalId?: string
  allowOverlapDefault?: boolean
  appointment?: {
    id: string
    patient_id: string
    procedure_id: string | null
    professional_id: string | null
    room_id: string | null
    start_time: string
    end_time: string
    notes: string | null
    status: string
    valor_cobrado?: number | null
    desconto_tipo?: 'valor' | 'percentual' | null
    desconto_valor?: number | null
  }
}

export default function AppointmentForm({ 
  clinicId, 
  patients: initialPatients, 
  procedures, 
  professionals, 
  rooms,
  defaultPatientId,
  defaultDate,
  defaultTime,
  defaultProfessionalId: propDefaultProfessionalId,
  allowOverlapDefault = false,
  appointment
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!appointment

  const defaultStartDate = defaultDate || todayBR()
  const defaultStartTime = defaultTime || '09:00'

  const [patients, setPatients] = useState(initialPatients)
  const [showNewPatient, setShowNewPatient] = useState(false)
  
  // Auto-seleciona profissional: prop > editando > único profissional
  const defaultProfessionalId = propDefaultProfessionalId || 
    appointment?.professional_id || 
    (professionals.length === 1 ? professionals[0].id : '')
  
  // Múltiplos procedimentos
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>(
    appointment?.procedure_id ? [appointment.procedure_id] : []
  )
  
  const [form, setForm] = useState({
    patient_id: appointment?.patient_id || defaultPatientId || '',
    professional_id: defaultProfessionalId,
    room_id: appointment?.room_id || '',
    date: appointment ? appointment.start_time.split('T')[0] : defaultStartDate,
    start_time: appointment ? appointment.start_time.split('T')[1].slice(0, 5) : defaultStartTime,
    duration: '30',
    notes: appointment?.notes || '',
    status: appointment?.status || 'scheduled',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Valor cobrado no agendamento -- algumas clinicas ja fecham o desconto aqui
  // na hora de marcar, nao so' no atendimento. Gravar valor_cobrado/desconto_*
  // ja' na criacao faz a Previsao de Faturamento refletir de imediato (ela le
  // valor_cobrado com prioridade sobre o preco de tabela do procedimento).
  const [valorManualStr, setValorManualStr] = useState(
    appointment?.valor_cobrado != null ? String(appointment.valor_cobrado) : ''
  )
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'percentual'>(appointment?.desconto_tipo || 'valor')
  const [descontoValorStr, setDescontoValorStr] = useState(
    appointment?.desconto_valor ? String(appointment.desconto_valor) : ''
  )
  const [editandoValor, setEditandoValor] = useState(false)

  // Pacotes ativos do paciente selecionado
  const [activePackages, setActivePackages] = useState<{ id: string; name: string; total_sessions: number; used_sessions: number }[]>([])
  useEffect(() => {
    if (!form.patient_id) { setActivePackages([]); return }
    supabase
      .from('patient_packages')
      .select('id, name, total_sessions, used_sessions')
      .eq('patient_id', form.patient_id)
      .eq('status', 'active')
      .then(({ data }) => setActivePackages(data || []))
  }, [form.patient_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modo de pacote: nenhum, vincular a um pacote ativo existente, ou criar um novo
  const [packageMode, setPackageMode] = useState<'none' | 'existing' | 'new'>('none')
  const isPackage = packageMode === 'new' // mantém nome usado mais abaixo pro pré-preenchimento de nome
  const [linkedPackageId, setLinkedPackageId] = useState('')
  const [packageForm, setPackageForm] = useState({ name: '', total_sessions: '3', price_total: '' })

  // Sessões seguintes agendadas em lote (semanal/quinzenal/manual, cada uma editável)
  const [extraSessionRows, setExtraSessionRows] = useState<ScheduledSessionRow[]>([])

  const linkedPackage = activePackages.find(p => p.id === linkedPackageId) || null
  const remainingOnLinkedPackage = linkedPackage ? linkedPackage.total_sessions - linkedPackage.used_sessions : 0

  // Quantas sessões futuras (além desta) devem ser pré-agendadas
  const extraSessionsCount = packageMode === 'new'
    ? Math.max((parseInt(packageForm.total_sessions, 10) || 1) - 1, 0)
    : packageMode === 'existing'
      ? Math.max(remainingOnLinkedPackage - 1, 0)
      : 0

  // Pré-preenche nome do pacote com o procedimento selecionado
  useEffect(() => {
    if (isPackage && selectedProcedures.length > 0 && !packageForm.name) {
      const proc = procedures.find(p => p.id === selectedProcedures[0])
      if (proc) setPackageForm(f => ({ ...f, name: proc.name }))
    }
  }, [isPackage, selectedProcedures]) // eslint-disable-line react-hooks/exhaustive-deps

  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [hasScheduleConfigured, setHasScheduleConfigured] = useState<boolean | null>(null)
  const [allowOverlap, setAllowOverlap] = useState(allowOverlapDefault)
  const [manualTime, setManualTime] = useState(allowOverlapDefault ? (defaultTime || '') : '')

  // Calcula duração total baseado nos procedimentos selecionados
  useEffect(() => {
    if (selectedProcedures.length > 0) {
      const totalDuration = selectedProcedures.reduce((sum, procId) => {
        const proc = procedures.find(p => p.id === procId)
        return sum + (proc?.duration_minutes || 0)
      }, 0)
      setForm(prev => ({ ...prev, duration: totalDuration.toString() }))
    }
  }, [selectedProcedures, procedures])

  // No agendamento manual, todos os profissionais ficam disponíveis sempre.
  // O vínculo procedimento → profissional é usado APENAS pela Eva (agendamento automático).
  // Aqui a secretaria tem liberdade total de escolha.
  const eligibleProfessionals = professionals

  // Se o profissional atual deixou de ser elegível, limpar
  useEffect(() => {
    if (
      form.professional_id &&
      eligibleProfessionals.length > 0 &&
      !eligibleProfessionals.some(p => p.id === form.professional_id)
    ) {
      setForm(prev => ({ ...prev, professional_id: '' }))
    }
  }, [selectedProcedures]) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca slots disponíveis quando profissional + data + duração mudarem
  useEffect(() => {
    async function loadSlots() {
      if (!form.professional_id || !form.date) {
        setAvailableSlots([])
        setHasScheduleConfigured(null)
        return
      }
      setLoadingSlots(true)

      const { data, error: rpcErr } = await supabase.rpc('get_available_slots', {
        p_clinic_id: clinicId,
        p_date: form.date,
        p_professional_id: form.professional_id,
        p_duration_min: parseInt(form.duration) || 30,
      })

      if (rpcErr) {
        console.error('Erro ao buscar slots:', rpcErr)
        setAvailableSlots([])
        setLoadingSlots(false)
        return
      }

      const { count } = await supabase
        .from('professional_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', form.professional_id)
        .eq('is_active', true)

      setHasScheduleConfigured((count ?? 0) > 0)

      const slots: string[] = (data || []).map((s: any) => String(s.slot_time).slice(0, 5))
      setAvailableSlots(slots)
      setLoadingSlots(false)
    }
    loadSlots()
  }, [form.professional_id, form.date, form.duration, clinicId, supabase])

  const handleNewPatient = (patient: { id: string; name: string; phone?: string | null }) => {
    setPatients(prev => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(prev => ({ ...prev, patient_id: patient.id }))
  }

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleProcedure = (procId: string) => {
    setSelectedProcedures(prev => 
      prev.includes(procId) 
        ? prev.filter(id => id !== procId)
        : [...prev, procId]
    )
  }

  // Calcula preço total
  const totalPrice = selectedProcedures.reduce((sum, procId) => {
    const proc = procedures.find(p => p.id === procId)
    return sum + (proc?.price || 0)
  }, 0)

  const valorManualNum = parseFloat(valorManualStr.replace(',', '.'))
  const baseValor = !isNaN(valorManualNum) ? valorManualNum : totalPrice
  const descontoNum = parseFloat(descontoValorStr) || 0
  const valorFinal = descontoNum > 0
    ? (descontoTipo === 'percentual' ? Math.max(0, baseValor * (1 - descontoNum / 100)) : Math.max(0, baseValor - descontoNum))
    : baseValor

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validação obrigatória
    if (!form.patient_id) {
      setError('Selecione um paciente')
      setLoading(false)
      return
    }
    if (!form.professional_id) {
      setError('Selecione um profissional responsável')
      setLoading(false)
      return
    }

    const startTime = new Date(`${form.date}T${form.start_time}:00`)
    const endTime = new Date(startTime.getTime() + parseInt(form.duration) * 60000)

    // Monta lista de procedimentos para as notas
    const procedureNames = selectedProcedures.map(id => {
      const proc = procedures.find(p => p.id === id)
      return proc?.name
    }).filter(Boolean).join(', ')

    const notesWithProcedures = selectedProcedures.length > 1 
      ? `Procedimentos: ${procedureNames}${form.notes ? '\n' + form.notes : ''}`
      : form.notes

    // So' grava valor_cobrado/desconto se a secretaria de fato mexeu em algum
    // dos dois campos. Sem isso, toda venda passaria a ter valor_cobrado igual
    // a soma dos procedimentos -- que ja' e' o fallback natural em todo lugar
    // que le esse campo (previsao, payment-modal), so' que sem travar o valor.
    const valorFoiEditado = valorManualStr !== '' || descontoNum > 0

    // package_id desta sessão: pacote vinculado existente, ou o pacote novo (setado depois de criá-lo)
    const linkedForThisAppointment = packageMode === 'existing' ? linkedPackageId || null : null

    const appointmentData = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      professional_id: form.professional_id,
      procedure_id: selectedProcedures[0] || null, // Primeiro procedimento como principal
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: notesWithProcedures || null,
      status: form.status,
      package_id: linkedForThisAppointment,
      ...(valorFoiEditado ? {
        valor_cobrado: selectedProcedures.length > 0 ? valorFinal : null,
        desconto_tipo: descontoNum > 0 ? descontoTipo : null,
        desconto_valor: descontoNum > 0 ? descontoNum : null,
      } : {}),
    }

    let result
    let appointmentId: string | null = null
    if (isEditing) {
      result = await supabase
        .from('appointments')
        .update(appointmentData)
        .eq('id', appointment.id)
      appointmentId = appointment.id
    } else {
      result = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select('id')
        .single()
      appointmentId = result.data?.id || null
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    // Salvar múltiplos procedimentos em appointment_procedures
    if (appointmentId && selectedProcedures.length > 0) {
      // Remover os anteriores (em caso de edição)
      if (isEditing) {
        await supabase.from('appointment_procedures').delete().eq('appointment_id', appointmentId)
      }
      // Inserir todos os procedimentos selecionados
      const apRows = selectedProcedures.map(procId => {
        const proc = procedures.find(p => p.id === procId)
        return {
          clinic_id: clinicId,
          appointment_id: appointmentId,
          procedure_id: procId,
          procedure_name: proc?.name || '',
          price: proc?.price || 0,
          duration_minutes: proc?.duration_minutes || 30,
        }
      })
      await supabase.from('appointment_procedures').insert(apRows)
    }

    // Pacote novo: cria o pacote e vincula este agendamento a ele como 1ª sessão
    // (a sessão só é de fato consumida quando o status virar "Realizado" — via trigger no banco)
    let packageIdForBatch: string | null = null
    if (packageMode === 'new' && packageForm.name.trim() && appointmentId) {
      const { data: newPkg } = await supabase
        .from('patient_packages')
        .insert({
          clinic_id: clinicId,
          patient_id: form.patient_id,
          name: packageForm.name.trim(),
          total_sessions: Math.min(Math.max(parseInt(packageForm.total_sessions, 10) || 1, 1), 100),
          price_total: packageForm.price_total ? parseFloat(packageForm.price_total) : null,
          procedure_id: selectedProcedures[0] || null,
          sold_at: form.date,
          status: 'active',
        })
        .select('id')
        .single()

      if (newPkg) {
        packageIdForBatch = newPkg.id
        await supabase.from('appointments').update({ package_id: newPkg.id }).eq('id', appointmentId)
      }
    } else if (packageMode === 'existing' && linkedPackageId) {
      packageIdForBatch = linkedPackageId
    }

    // Sessões seguintes pré-agendadas (semanal/quinzenal/manual) — cada uma vira
    // um agendamento independente vinculado ao mesmo pacote, sem consumir sessão até ser concluído
    if (packageIdForBatch && extraSessionRows.length > 0) {
      const extraRows = extraSessionRows.map(row => {
        const start = new Date(`${row.date}T${row.time}:00`)
        const end = new Date(start.getTime() + parseInt(form.duration) * 60000)
        return {
          clinic_id: clinicId,
          patient_id: form.patient_id,
          professional_id: form.professional_id,
          procedure_id: selectedProcedures[0] || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          notes: notesWithProcedures || null,
          status: 'scheduled',
          package_id: packageIdForBatch,
          valor_cobrado: 0,
        }
      })
      const { error: batchError } = await supabase.from('appointments').insert(extraRows)
      if (batchError) {
        // Não bloqueia o fluxo — o agendamento principal já foi salvo; só avisa
        console.error('Erro ao agendar sessões seguintes do pacote:', batchError)
      }
    }

    router.push(`/dashboard/agenda?date=${form.date}`)
    router.refresh()
  }

  return (
    <>
    {showNewPatient && (
      <QuickPatientModal
        clinicId={clinicId}
        onPatientCreated={handleNewPatient}
        onClose={() => setShowNewPatient(false)}
      />
    )}
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Paciente *</label>
          <button
            type="button"
            onClick={() => setShowNewPatient(true)}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
          >
            <Icon name="plus" className="w-3 h-3" />
            Novo paciente
          </button>
        </div>
        <PatientSearch
          patients={patients}
          value={form.patient_id}
          onChange={(id) => update('patient_id', id)}
          placeholder="Digite o nome do paciente..."
          required
        />

        {/* Alerta de pacotes ativos */}
        {activePackages.length > 0 && (
          <div className="mt-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
              Pacotes ativos — sessões disponíveis
            </p>
            {activePackages.map(pkg => {
              const remaining = pkg.total_sessions - pkg.used_sessions
              const pct = Math.min((pkg.used_sessions / pkg.total_sessions) * 100, 100)
              return (
                <div key={pkg.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{pkg.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-20 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-violet-600 font-medium whitespace-nowrap">
                        {remaining} sessão{remaining !== 1 ? 'ões' : ''} restante{remaining !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <label className="label">Profissional responsável *</label>
        <select
          className={`input ${!form.professional_id ? 'border-amber-300 bg-amber-50 focus:ring-amber-500' : ''}`}
          value={form.professional_id}
          onChange={e => update('professional_id', e.target.value)}
          required
          disabled={eligibleProfessionals.length === 0}
        >
          <option value="">⚠️ Selecione quem vai atender</option>
          {eligibleProfessionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {!form.professional_id && eligibleProfessionals.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">Obrigatório: selecione o profissional responsável</p>
        )}
      </div>

      {/* Múltiplos procedimentos */}
      <div>
        <label className="label">Procedimentos</label>
        <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
          {procedures.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Nenhum procedimento cadastrado</p>
          ) : (
            procedures.map(proc => (
              <label
                key={proc.id}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                  selectedProcedures.includes(proc.id) ? 'bg-violet-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProcedures.includes(proc.id)}
                  onChange={() => toggleProcedure(proc.id)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900" title={proc.name}>{proc.name}</p>
                  <p className="text-xs text-slate-500">{proc.duration_minutes} min</p>
                </div>
                <span className="text-sm font-medium text-slate-600">
                  R$ {proc.price.toFixed(2)}
                </span>
              </label>
            ))
          )}
        </div>
        {selectedProcedures.length > 0 && (
          <div className="mt-2 p-2 bg-violet-50 rounded-lg flex justify-between text-sm">
            <span className="text-violet-700">
              {selectedProcedures.length} procedimento{selectedProcedures.length > 1 ? 's' : ''} • {form.duration} min
            </span>
            <span className="font-semibold text-violet-900">
              Total: R$ {totalPrice.toFixed(2)}
            </span>
          </div>
        )}

        {/* Valor cobrado / desconto no agendamento -- reflete direto na Previsao
            de Faturamento, que prioriza valor_cobrado sobre o preco de tabela. */}
        {selectedProcedures.length > 0 && (
          !editandoValor && valorManualStr === '' && descontoNum === 0 ? (
            <button
              type="button"
              onClick={() => setEditandoValor(true)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-violet-500 hover:text-violet-700 border border-dashed border-violet-200 hover:border-violet-400 rounded-lg transition-colors"
            >
              <Icon name="gift" className="w-3.5 h-3.5" /> Aplicar valor ou desconto no agendamento
            </button>
          ) : (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Valor cobrado neste agendamento</p>
                <button
                  type="button"
                  onClick={() => { setValorManualStr(''); setDescontoValorStr(''); setEditandoValor(false) }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Usar preço de tabela
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400">Valor (R$)</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder={totalPrice.toFixed(2)}
                    value={valorManualStr}
                    onChange={e => setValorManualStr(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-slate-400">Desc.</label>
                  <select
                    value={descontoTipo}
                    onChange={e => setDescontoTipo(e.target.value as 'valor' | 'percentual')}
                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="valor">R$</option>
                    <option value="percentual">%</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="text-xs text-slate-400">&nbsp;</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0"
                    value={descontoValorStr}
                    onChange={e => setDescontoValorStr(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              {(valorManualStr !== '' || descontoNum > 0) && (
                <p className="text-xs text-emerald-600 font-medium">
                  {baseValor !== totalPrice || descontoNum > 0
                    ? <>Cobrado: R$ {valorFinal.toFixed(2)} <span className="text-slate-400 font-normal">(tabela: R$ {totalPrice.toFixed(2)})</span></>
                    : null}
                </p>
              )}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Data *</label>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={e => update('date', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Horário *</label>
          <input
            type="time"
            className="input"
            value={form.start_time}
            onChange={e => update('start_time', e.target.value)}
            step="300"
            required
          />
        </div>
      </div>

      {form.professional_id && form.date && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Horários disponíveis</label>
            {loadingSlots && <span className="text-xs text-slate-400">carregando...</span>}
          </div>
          {hasScheduleConfigured === false ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Este profissional ainda não tem horários cadastrados.
              {' '}
              <a href="/dashboard/equipe" className="underline font-medium">
                Configurar em Equipe
              </a>
            </div>
          ) : availableSlots.length === 0 && !loadingSlots ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                Sem horários livres nesta data. Tente outro dia ou ajuste a duração.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverlap}
                  onChange={e => setAllowOverlap(e.target.checked)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-600 font-medium">Agendar mesmo assim (sobrepor horário)</span>
              </label>
              {allowOverlap && (
                <input
                  type="time"
                  value={manualTime}
                  onChange={e => { setManualTime(e.target.value); update('start_time', e.target.value) }}
                  className="input w-36 text-sm"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => update('start_time', slot)}
                    className={`px-2.5 py-1 rounded-lg text-sm border transition-colors ${
                      form.start_time === slot
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-violet-400 hover:bg-violet-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {/* Opção de sobrepor — mesmo quando há slots livres */}
              <div className="pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverlap}
                    onChange={e => { setAllowOverlap(e.target.checked); if (!e.target.checked) setManualTime('') }}
                    className="w-4 h-4 text-violet-600 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-500">Marcar em horário já ocupado (dois pacientes)</span>
                </label>
                {allowOverlap && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="time"
                      value={manualTime}
                      onChange={e => { setManualTime(e.target.value); update('start_time', e.target.value) }}
                      className="input w-36 text-sm"
                    />
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      Será sobreposto ao agendamento existente
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label">Duração (minutos)</label>
        <select
          className="input"
          value={form.duration}
          onChange={e => update('duration', e.target.value)}
        >
          <option value="15">15 min</option>
          <option value="20">20 min</option>
          <option value="25">25 min</option>
          <option value="30">30 min</option>
          <option value="35">35 min</option>
          <option value="40">40 min</option>
          <option value="45">45 min</option>
          <option value="50">50 min</option>
          <option value="55">55 min</option>
          <option value="60">1 hora</option>
          <option value="75">1h 15min</option>
          <option value="90">1h 30min</option>
          <option value="105">1h 45min</option>
          <option value="120">2 horas</option>
          <option value="150">2h 30min</option>
          <option value="180">3 horas</option>
        </select>
      </div>


      {isEditing && (
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={e => update('status', e.target.value)}
          >
            <option value="scheduled">Agendado</option>
            <option value="confirmed">Confirmado</option>
            <option value="in_progress">Em atendimento</option>
            <option value="completed">Realizado</option>
            <option value="cancelled">Cancelado</option>
            <option value="no_show">Faltou</option>
          </select>
        </div>
      )}

      <div>
        <label className="label">Observacoes</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Anotacoes sobre o agendamento..."
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </div>

      {/* Pacote de sessões — só aparece quando há paciente selecionado */}
      {form.patient_id && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 space-y-2">
            {activePackages.length > 0 && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="packageMode"
                  checked={packageMode === 'existing'}
                  onChange={() => {
                    setPackageMode('existing')
                    if (!linkedPackageId) setLinkedPackageId(activePackages[0].id)
                  }}
                  className="w-4 h-4 text-violet-600 border-slate-300 focus:ring-violet-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Vincular a um pacote ativo</p>
                  <p className="text-xs text-slate-400">Descontar sessão de um pacote já existente do paciente</p>
                </div>
              </label>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="packageMode"
                checked={packageMode === 'new'}
                onChange={() => setPackageMode('new')}
                className="w-4 h-4 text-violet-600 border-slate-300 focus:ring-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Criar novo pacote de sessões</p>
                <p className="text-xs text-slate-400">Clube do Botox, Lavieen, Microvasos...</p>
              </div>
            </label>
            {packageMode !== 'none' && (
              <button
                type="button"
                onClick={() => { setPackageMode('none'); setLinkedPackageId(''); setExtraSessionRows([]) }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Não é pacote, cancelar
              </button>
            )}
          </div>

          {packageMode === 'existing' && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-violet-50/40">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Pacote</label>
                <select
                  className="input"
                  value={linkedPackageId}
                  onChange={e => setLinkedPackageId(e.target.value)}
                >
                  {activePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.total_sessions - pkg.used_sessions} sessão(ões) restante(s)
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-violet-600 bg-violet-100 rounded-xl px-3 py-2">
                Esta sessão só é descontada do pacote quando o atendimento for marcado como Realizado.
              </p>
            </div>
          )}

          {packageMode === 'new' && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-violet-50/40">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nome do pacote *</label>
                <input
                  className="input"
                  placeholder="Ex: Clube do Botox, Pacote Lavieen..."
                  value={packageForm.name}
                  onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Total de sessões *</label>
                  <input
                    type="number" min={1} max={100} inputMode="numeric"
                    className="input"
                    value={packageForm.total_sessions}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '' || /^\d{1,3}$/.test(v)) setPackageForm(f => ({ ...f, total_sessions: v }))
                    }}
                    onBlur={e => {
                      const n = parseInt(e.target.value, 10)
                      const clamped = isNaN(n) ? 1 : Math.min(Math.max(n, 1), 100)
                      setPackageForm(f => ({ ...f, total_sessions: String(clamped) }))
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Valor total (R$)</label>
                  <input
                    type="number" step="0.01" min={0}
                    className="input"
                    placeholder="0,00"
                    value={packageForm.price_total}
                    onChange={e => setPackageForm(f => ({ ...f, price_total: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-[11px] text-violet-600 bg-violet-100 rounded-xl px-3 py-2">
                Este agendamento será a 1ª sessão do pacote (descontada só quando concluído).
              </p>
            </div>
          )}

          {packageMode !== 'none' && (
            <PackageSessionScheduler
              count={extraSessionsCount}
              firstDate={form.date}
              firstTime={form.start_time}
              rows={extraSessionRows}
              onChange={setExtraSessionRows}
            />
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Agendar'}
        </button>
        <button 
          type="button" 
          onClick={() => router.back()} 
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
    </>
  )
}
