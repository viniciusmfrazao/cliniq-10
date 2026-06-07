'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Props = {
  clinic: {
    id: string; name: string; slug: string; trial_ends_at?: string
    settings?: {
      address?: string; phone?: string; hours?: string
      instagram?: string; parking?: string; observations?: string
      cnpj?: string; responsible?: string
    } | null
  } | null
  automations?: {
    relatorio_semanal?: boolean; relatorio_telefones?: string | null
    relatorio_hora?: string | null; relatorio_dia?: number | null
  } | null
}

export default function ClinicSettings({ clinic, automations }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [openSection, setOpenSection] = useState<string>('dados')

  const s = clinic?.settings || {}
  const [name, setName]                 = useState(clinic?.name || '')
  const [address, setAddress]           = useState(s.address || '')
  const [phone, setPhone]               = useState(s.phone || '')
  const [hours, setHours]               = useState(s.hours || '')
  const [instagram, setInstagram]       = useState(s.instagram || '')
  const [cnpj, setCnpj]                 = useState(s.cnpj || '')
  const [responsible, setResponsible]   = useState(s.responsible || '')
  const [observations, setObservations] = useState(s.observations || '')
  const [savingClinic, setSavingClinic] = useState(false)
  const [successClinic, setSuccessClinic] = useState(false)

  const [relAtivo, setRelAtivo]         = useState(automations?.relatorio_semanal ?? false)
  const [relTelefones, setRelTelefones] = useState(() => {
    const t = automations?.relatorio_telefones
    if (!t) return ''
    if (Array.isArray(t)) return t.join(',')
    return String(t)
  })
  const [relHora, setRelHora]           = useState(automations?.relatorio_hora || '10:00')
  const [relDia, setRelDia]             = useState(automations?.relatorio_dia ?? 1)
  const [sendingRelNow, setSendingRelNow] = useState(false)
  const [sentRelNow, setSentRelNow]     = useState(false)
  const [savingRel, setSavingRel]       = useState(false)
  const [successRel, setSuccessRel]     = useState(false)
  const [newPhone, setNewPhone]         = useState('')

  const phoneList = relTelefones ? String(relTelefones).split(',').map(p => p.trim()).filter(Boolean) : []

  function toggle(s: string) { setOpenSection(openSection === s ? '' : s) }

  function addPhone() {
    const p = newPhone.replace(/\D/g, '')
    if (!p || p.length < 10) return
    const full = p.startsWith('55') ? p : '55' + p
    if (!phoneList.includes(full)) setRelTelefones([...phoneList, full].join(','))
    setNewPhone('')
  }

  function removePhone(p: string) {
    setRelTelefones(phoneList.filter(x => x !== p).join(','))
  }

  async function saveClinic(e: React.FormEvent) {
    e.preventDefault()
    setSavingClinic(true)
    await supabase.from('clinics').update({
      name,
      settings: {
        ...(clinic?.settings || {}),
        address: address.trim() || null, phone: phone.trim() || null,
        hours: hours.trim() || null, instagram: instagram.trim() || null,
        cnpj: cnpj.trim() || null, responsible: responsible.trim() || null,
        observations: observations.trim() || null,
      }
    }).eq('id', clinic?.id)
    setSavingClinic(false)
    setSuccessClinic(true)
    router.refresh()
    setTimeout(() => setSuccessClinic(false), 3000)
  }

  async function sendRelatorioAgora() {
    setSendingRelNow(true)
    setSentRelNow(false)
    try {
      const r = await fetch('/api/config/relatorio-semanal/send-now', { method: 'POST' })
      const data = await r.json()
      if (data.ok) {
        setSentRelNow(true)
        setTimeout(() => setSentRelNow(false), 4000)
      } else {
        alert(data.error || 'Erro ao enviar relatório')
      }
    } catch { alert('Erro de conexão') }
    finally { setSendingRelNow(false) }
  }

  async function saveRelatorio() {
    setSavingRel(true)
    try {
      const res = await fetch('/api/config/relatorio-semanal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relatorio_semanal: relAtivo,
          relatorio_telefones: relTelefones || '',
          relatorio_hora: relHora,
          relatorio_dia: relDia,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Erro ao salvar: ' + (data.error || res.status))
      } else {
        setSuccessRel(true)
        setTimeout(() => setSuccessRel(false), 3000)
      }
    } catch (e) {
      alert('Erro de conexão ao salvar relatório')
    }
    setSavingRel(false)
  }

  const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

  return (
    <div className="space-y-3">

      {/* Dados da Clínica */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => toggle('dados')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span>🏥</span>
            <span className="font-semibold text-slate-900">Dados da Clínica</span>
          </div>
          <Icon name={openSection === 'dados' ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-slate-400" />
        </button>

        {openSection === 'dados' && (
          <form onSubmit={saveClinic} className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">

            <div>
              <label className="label">Nome da Clínica</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Clínica Sarah Pina" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">CNPJ</label>
                <input className="input" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="label">Responsável</label>
                <input className="input" value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome do responsável" />
              </div>
            </div>

            <div>
              <label className="label">Endereço completo</label>
              <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" />
              <p className="text-xs text-slate-400 mt-1">A Eva usa esse endereço ao confirmar agendamentos</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Telefone / WhatsApp</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(34) 99999-9999" />
              </div>
              <div>
                <label className="label">Horário de funcionamento</label>
                <input className="input" value={hours} onChange={e => setHours(e.target.value)} placeholder="Seg a Sex 8h–18h" />
              </div>
            </div>

            <div>
              <label className="label">Instagram</label>
              <input className="input" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@clinicasarahpina" />
            </div>

            <div>
              <label className="label">Observações internas</label>
              <textarea className="input resize-none" rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Informações internas..." />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Slug: <span className="font-mono">{clinic?.slug}</span> (não pode ser alterado)</p>
              <button type="submit" disabled={savingClinic} className="btn-primary px-5 py-2 flex items-center gap-2 text-sm">
                {savingClinic
                  ? <><Icon name="loader" className="w-4 h-4 animate-spin" /> Salvando...</>
                  : successClinic
                  ? <><Icon name="check" className="w-4 h-4" /> Salvo!</>
                  : 'Salvar dados'
                }
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Relatório Semanal */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => toggle('relatorio')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span>📊</span>
            <span className="font-semibold text-slate-900">Relatório Semanal</span>
          </div>
          <Icon name={openSection === 'relatorio' ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-slate-400" />
        </button>

        {openSection === 'relatorio' && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">

            {/* Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-800 text-sm">Enviar relatório semanal</p>
                <p className="text-xs text-slate-500 mt-0.5">Agendamentos, faturamento, procedimentos e estoque</p>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Dia da semana</label>
                    <select className="input" value={relDia} onChange={e => setRelDia(Number(e.target.value))}>
                      {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Horário</label>
                    <input type="time" className="input" value={relHora} onChange={e => setRelHora(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="label">Números que recebem o relatório</label>
                  {phoneList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {phoneList.map(p => (
                        <span key={p} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs px-3 py-1.5 rounded-full">
                          {p}
                          <button type="button" onClick={() => removePhone(p)} className="text-violet-300 hover:text-red-500 transition-colors ml-1">✕</button>
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
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhone() } }}
                    />
                    <button type="button" onClick={addPhone} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
                      + Adicionar
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Pressione Enter ou clique Adicionar</p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={sendRelatorioAgora} disabled={sendingRelNow}
                className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                {sendingRelNow
                  ? <><Icon name="loader" className="w-4 h-4 animate-spin" /> Enviando...</>
                  : sentRelNow
                  ? <><Icon name="check" className="w-4 h-4" /> Enviado!</>
                  : <><Icon name="send" className="w-4 h-4" /> Enviar agora</>
                }
              </button>
              <button type="button" onClick={saveRelatorio} disabled={savingRel}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                {savingRel
                  ? <><Icon name="loader" className="w-4 h-4 animate-spin" /> Salvando...</>
                  : successRel
                  ? <><Icon name="check" className="w-4 h-4" /> Salvo!</>
                  : 'Salvar configuração'
                }
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}


