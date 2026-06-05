'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import Icon from '@/components/ui/Icon'

type Automations = {
  relatorio_semanal?: boolean
  relatorio_telefones?: string | null
  relatorio_hora?: string | null
  relatorio_dia?: number | null
} | null

type Props = {
  clinic: {
    id: string
    name: string
    slug: string
    trial_ends_at?: string
    settings?: {
      address?: string; phone?: string; hours?: string
      instagram?: string; parking?: string; observations?: string
      cnpj?: string; responsible?: string
    } | null
  } | null
  automations?: Automations
}

export default function ClinicSettings({ clinic, automations }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [openSection, setOpenSection] = useState<string | null>('dados')

  // Dados da clínica
  const s = clinic?.settings || {}
  const [name, setName]               = useState(clinic?.name || '')
  const [address, setAddress]         = useState(s.address || '')
  const [phone, setPhone]             = useState(s.phone || '')
  const [hours, setHours]             = useState(s.hours || '')
  const [instagram, setInstagram]     = useState(s.instagram || '')
  const [cnpj, setCnpj]               = useState(s.cnpj || '')
  const [responsible, setResponsible] = useState(s.responsible || '')
  const [observations, setObservations] = useState(s.observations || '')
  const [savingClinic, setSavingClinic] = useState(false)

  // Relatório semanal
  const [relAtivo, setRelAtivo]         = useState(automations?.relatorio_semanal ?? false)
  const [relTelefones, setRelTelefones] = useState(automations?.relatorio_telefones || '')
  const [relHora, setRelHora]           = useState(automations?.relatorio_hora || '10:00')
  const [relDia, setRelDia]             = useState(automations?.relatorio_dia ?? 1)
  const [savingRel, setSavingRel]       = useState(false)
  const [newPhone, setNewPhone]         = useState('')

  const phoneList = relTelefones.split(',').map(p => p.trim()).filter(Boolean)

  function addPhone() {
    const p = newPhone.replace(/\D/g, '')
    if (!p || p.length < 10) return
    const full = p.startsWith('55') ? p : '55' + p
    if (!phoneList.includes(full)) {
      setRelTelefones([...phoneList, full].join(','))
    }
    setNewPhone('')
  }

  function removePhone(p: string) {
    setRelTelefones(phoneList.filter(x => x !== p).join(','))
  }

  async function saveClinic(e: React.FormEvent) {
    e.preventDefault()
    setSavingClinic(true)
    const newSettings = {
      ...(clinic?.settings || {}),
      address: address.trim() || null,
      phone: phone.trim() || null,
      hours: hours.trim() || null,
      instagram: instagram.trim() || null,
      cnpj: cnpj.trim() || null,
      responsible: responsible.trim() || null,
      observations: observations.trim() || null,
    }
    await supabase.from('clinics').update({ name, settings: newSettings }).eq('id', clinic?.id)
    setSavingClinic(false)
    toast.success('Dados salvos!')
    router.refresh()
  }

  async function saveRelatorio() {
    setSavingRel(true)
    await supabase.from('clinic_automations').upsert({
      clinic_id: clinic?.id,
      relatorio_semanal: relAtivo,
      relatorio_telefones: relTelefones || null,
      relatorio_hora: relHora,
      relatorio_dia: relDia,
    }, { onConflict: 'clinic_id' })
    setSavingRel(false)
    toast.success('Relatório configurado!')
    router.refresh()
  }

  const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

  const Section = ({ id, icon, title, children }: {
    id: string; icon: string; title: string; children: React.ReactNode
  }) => (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpenSection(openSection === id ? null : id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-slate-900">{title}</span>
        </div>
        <Icon
          name="chevronDown"
          className={`w-4 h-4 text-slate-400 transition-transform ${openSection === id ? 'rotate-180' : ''}`}
        />
      </button>
      {openSection === id && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {children}
        </div>
      )}
    </div>
  )

  const Field = ({ label, value, onChange, placeholder = '', hint = '', type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void
    placeholder?: string; hint?: string; type?: string
  }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Dados da Clínica */}
      <Section id="dados" icon="🏥" title="Dados da Clínica">
        <form onSubmit={saveClinic} className="space-y-4">
          <Field label="Nome da Clínica" value={name} onChange={setName} placeholder="Ex: Clínica Sarah Pina" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0001-00" />
            <Field label="Responsável" value={responsible} onChange={setResponsible} placeholder="Nome do responsável" />
          </div>
          <Field
            label="Endereço completo"
            value={address}
            onChange={setAddress}
            placeholder="Rua, número, bairro, cidade"
            hint="A Eva usa esse endereço ao confirmar agendamentos"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone / WhatsApp" value={phone} onChange={setPhone} placeholder="(34) 99999-9999" />
            <Field label="Horário de funcionamento" value={hours} onChange={setHours} placeholder="Seg a Sex 8h–18h" />
          </div>
          <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@clinicasarahpina" />
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Observações internas</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Informações internas da clínica..."
            />
          </div>
          <div className="pt-2">
            <div className="text-xs text-slate-400 mb-3">
              <span className="font-medium text-slate-500">Slug (URL):</span> {clinic?.slug} <span className="italic">(não pode ser alterado)</span>
            </div>
            <button
              type="submit"
              disabled={savingClinic}
              className="btn-primary px-6 py-2 flex items-center gap-2"
            >
              {savingClinic ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
              {savingClinic ? 'Salvando...' : 'Salvar dados'}
            </button>
          </div>
        </form>
      </Section>

      {/* Relatório Semanal */}
      <Section id="relatorio" icon="📊" title="Relatório Semanal">
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="font-medium text-slate-800 text-sm">Enviar relatório semanal</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Resumo de agendamentos, faturamento, procedimentos e estoque
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRelAtivo(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${relAtivo ? 'bg-violet-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${relAtivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {relAtivo && (
            <>
              {/* Dia e hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dia da semana</label>
                  <select
                    className="input"
                    value={relDia}
                    onChange={e => setRelDia(Number(e.target.value))}
                  >
                    {DIAS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Horário</label>
                  <input
                    type="time"
                    className="input"
                    value={relHora}
                    onChange={e => setRelHora(e.target.value)}
                  />
                </div>
              </div>

              {/* Números */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Números que recebem o relatório
                </label>
                {phoneList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {phoneList.map(p => (
                      <span key={p} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-sm px-3 py-1.5 rounded-full">
                        <Icon name="phone" className="w-3 h-3" />
                        {p}
                        <button
                          type="button"
                          onClick={() => removePhone(p)}
                          className="text-violet-400 hover:text-red-500 ml-1 transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="tel"
                    className="input flex-1"
                    placeholder="(34) 99999-9999"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                  />
                  <button
                    type="button"
                    onClick={addPhone}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="plus" className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Digite o número e pressione Adicionar ou Enter</p>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={saveRelatorio}
            disabled={savingRel}
            className="btn-primary px-6 py-2 flex items-center gap-2"
          >
            {savingRel ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
            {savingRel ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </Section>

    </div>
  )
}
