'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Clinic = {
  id: string
  name: string
  slug: string
  trial_ends_at: string
  settings?: {
    address?: string
    phone?: string
    hours?: string
    instagram?: string
    parking?: string
    observations?: string
  } | null
}

export default function ClinicSettings({ clinic }: { clinic: Clinic | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(clinic?.name || '')
  const s = clinic?.settings || {}
  const [address, setAddress]         = useState(s.address || '')
  const [phone, setPhone]             = useState(s.phone || '')
  const [hours, setHours]             = useState(s.hours || '')
  const [instagram, setInstagram]     = useState(s.instagram || '')
  const [parking, setParking]         = useState(s.parking || '')
  const [observations, setObservations] = useState(s.observations || '')
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)

    const newSettings = {
      ...(clinic?.settings || {}),
      address:      address.trim() || null,
      phone:        phone.trim() || null,
      hours:        hours.trim() || null,
      instagram:    instagram.trim() || null,
      parking:      parking.trim() || null,
      observations: observations.trim() || null,
    }

    await supabase
      .from('clinics')
      .update({ name, settings: newSettings })
      .eq('id', clinic?.id)

    setLoading(false)
    setSuccess(true)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  const trialEndsAt = clinic?.trial_ends_at
    ? new Date(clinic.trial_ends_at).toLocaleDateString('pt-BR')
    : '-'

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder = '', hint = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="label">Nome da clinica</label>
        <input className="input" type="text" value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div>
        <label className="label">Slug (URL)</label>
        <input className="input bg-slate-50" type="text" value={clinic?.slug || ''} disabled />
        <p className="text-xs text-slate-400 mt-1">O slug nao pode ser alterado</p>
      </div>

      <div>
        <label className="label">Trial expira em</label>
        <input className="input bg-slate-50" type="text" value={trialEndsAt} disabled />
      </div>

      <hr className="border-slate-100" />
      <p className="text-sm font-semibold text-slate-700">📍 Informações que a Eva usa nas respostas</p>

      {field('Endereço completo', address, setAddress, 'Ex: R. Roosevelt de Oliveira, 305 - Centro, Uberlândia/MG', 'A Eva passa esse endereço ao confirmar agendamentos')}
      {field('Telefone / WhatsApp', phone, setPhone, 'Ex: (34) 99999-9999')}
      {field('Horário de funcionamento', hours, setHours, 'Ex: Seg a Sex: 08h–19h. Sáb: 08h–12h.')}
      {field('Instagram', instagram, setInstagram, 'Ex: @clinicasarahpina')}
      {field('Estacionamento', parking, setParking, 'Ex: Estacionamento disponível no local')}

      <div>
        <label className="label">Observações para pacientes</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={observations}
          onChange={e => setObservations(e.target.value)}
          placeholder="Ex: Chegue 10 minutos antes para check-in..."
        />
      </div>

      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          Alterações salvas! A Eva já vai usar as novas informações.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </form>
  )
}
