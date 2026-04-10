'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type MedicalRecord = {
  id: string
  blood_type: string | null
  allergies: string[] | null
  chronic_conditions: string[] | null
  medications: string[] | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
}

export default function MedicalInfo({ 
  medicalRecord, 
  patientId 
}: { 
  medicalRecord: MedicalRecord | null
  patientId: string 
}) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    blood_type: medicalRecord?.blood_type || '',
    allergies: medicalRecord?.allergies?.join(', ') || '',
    chronic_conditions: medicalRecord?.chronic_conditions?.join(', ') || '',
    medications: medicalRecord?.medications?.join(', ') || '',
    emergency_contact_name: medicalRecord?.emergency_contact_name || '',
    emergency_contact_phone: medicalRecord?.emergency_contact_phone || '',
    notes: medicalRecord?.notes || '',
  })

  async function handleSave() {
    setLoading(true)
    
    const data = {
      blood_type: form.blood_type || null,
      allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      chronic_conditions: form.chronic_conditions ? form.chronic_conditions.split(',').map(s => s.trim()).filter(Boolean) : [],
      medications: form.medications ? form.medications.split(',').map(s => s.trim()).filter(Boolean) : [],
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      notes: form.notes || null,
    }

    await supabase
      .from('medical_records')
      .update(data)
      .eq('patient_id', patientId)

    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Dados Medicos</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Tipo sanguineo</label>
            <select 
              className="input"
              value={form.blood_type}
              onChange={e => setForm({ ...form, blood_type: e.target.value })}
            >
              <option value="">Selecione</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div>
            <label className="label">Alergias (separar por virgula)</label>
            <input 
              className="input"
              placeholder="Dipirona, Penicilina..."
              value={form.allergies}
              onChange={e => setForm({ ...form, allergies: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Condicoes cronicas</label>
            <input 
              className="input"
              placeholder="Diabetes, Hipertensao..."
              value={form.chronic_conditions}
              onChange={e => setForm({ ...form, chronic_conditions: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Medicamentos em uso</label>
            <input 
              className="input"
              placeholder="Losartana 50mg, Metformina..."
              value={form.medications}
              onChange={e => setForm({ ...form, medications: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Contato de emergencia</label>
            <div className="grid grid-cols-2 gap-2">
              <input 
                className="input"
                placeholder="Nome"
                value={form.emergency_contact_name}
                onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
              />
              <input 
                className="input"
                placeholder="Telefone"
                value={form.emergency_contact_phone}
                onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Observacoes gerais</label>
            <textarea 
              className="input min-h-[80px]"
              placeholder="Outras informacoes relevantes..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Dados Medicos</h2>
        <button onClick={() => setEditing(true)} className="text-xs text-brand-600 font-medium">
          Editar
        </button>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Tipo sanguineo</p>
          <p className="text-slate-900">{medicalRecord?.blood_type || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Alergias</p>
          {medicalRecord?.allergies?.length ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {medicalRecord.allergies.map(a => (
                <span key={a} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">Nenhuma registrada</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400">Condicoes cronicas</p>
          {medicalRecord?.chronic_conditions?.length ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {medicalRecord.chronic_conditions.map(c => (
                <span key={c} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">Nenhuma registrada</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400">Medicamentos</p>
          <p className="text-slate-900">{medicalRecord?.medications?.join(', ') || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Emergencia</p>
          <p className="text-slate-900">
            {medicalRecord?.emergency_contact_name 
              ? `${medicalRecord.emergency_contact_name} - ${medicalRecord.emergency_contact_phone}`
              : '-'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
