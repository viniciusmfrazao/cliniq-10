'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Template = {
  id: string
  name: string
  content: string
  category: string
}

type Patient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpf: string | null
}

type Props = {
  clinicId: string
  clinicName: string
  templates: Template[]
  patients: Patient[]
  userId: string
  preSelectedPatient?: string
  appointmentId?: string
}

export default function SendDocumentForm({ clinicId, clinicName, templates, patients, userId, preSelectedPatient, appointmentId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [content, setContent] = useState('')
  const [searchPatient, setSearchPatient] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (preSelectedPatient) {
      const patient = patients.find(p => p.id === preSelectedPatient)
      if (patient) {
        setSelectedPatient(patient)
        setStep(2)
      }
    }
  }, [preSelectedPatient, patients])

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    const now = new Date()
    let processedContent = template.content
      .replace(/\{\{PACIENTE_NOME\}\}/g, selectedPatient?.name || '')
      .replace(/\{\{PACIENTE_CPF\}\}/g, selectedPatient?.cpf || '')
      .replace(/\{\{PACIENTE_EMAIL\}\}/g, selectedPatient?.email || '')
      .replace(/\{\{PACIENTE_TELEFONE\}\}/g, selectedPatient?.phone || '')
      .replace(/\{\{DATA\}\}/g, now.toLocaleDateString('pt-BR'))
      .replace(/\{\{HORA\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{CLINICA_NOME\}\}/g, clinicName)
    setContent(processedContent)
    setStep(3)
  }

  const generateToken = () => {
    return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
  }

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedTemplate) return
    setLoading(true)

    try {
      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data, error } = await supabase
        .from('documents_sent')
        .insert({
          clinic_id: clinicId,
          template_id: selectedTemplate.id,
          patient_id: selectedPatient.id,
          appointment_id: appointmentId || null,
          name: selectedTemplate.name,
          content,
          status: 'pending',
          sent_by: userId,
          sign_token: token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      const signUrl = `${window.location.origin}/assinar/${token}`
      
      alert(`Documento enviado com sucesso!\n\nLink para assinatura:\n${signUrl}\n\nEnvie este link para o paciente via WhatsApp ou email.`)
      
      router.push('/dashboard/documentos')
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('Erro ao enviar documento')
    } finally {
      setLoading(false)
    }
  }

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.phone?.includes(searchPatient)
  )

  return (
    <div className="space-y-6">
      {/* Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= s ? 'gradient-bg text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-[var(--color-primary)]' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <div className="ml-4 text-sm text-slate-600">
          {step === 1 && 'Selecione o paciente'}
          {step === 2 && 'Escolha o documento'}
          {step === 3 && 'Revise e envie'}
        </div>
      </div>

      {/* Step 1: Select Patient */}
      {step === 1 && (
        <div className="card p-6">
          <div className="relative mb-4">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchPatient}
              onChange={e => setSearchPatient(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredPatients.map(patient => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient)
                  setStep(2)
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-semibold">
                  {patient.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{patient.name}</p>
                  <p className="text-sm text-slate-500">{patient.email || patient.phone || '-'}</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Template */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-semibold">
              {selectedPatient?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{selectedPatient?.name}</p>
              <p className="text-sm text-slate-500">{selectedPatient?.email || selectedPatient?.phone}</p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Alterar
            </button>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Selecione o documento</h3>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-3">Nenhum template disponivel</p>
                <a href="/dashboard/documentos/templates/novo" className="text-[var(--color-primary)] hover:underline text-sm">
                  Criar template
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Icon name="file" className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{template.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{template.category}</p>
                    </div>
                    <Icon name="chevronRight" className="w-5 h-5 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review and Send */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-semibold">
              {selectedPatient?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{selectedPatient?.name}</p>
              <p className="text-sm text-slate-500">{selectedTemplate?.name}</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Alterar
            </button>
          </div>

          <div className="card p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Conteudo do documento</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all font-mono text-sm resize-none"
              rows={15}
            />
            <p className="text-xs text-slate-500 mt-2">
              Voce pode editar o conteudo antes de enviar
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="btn-secondary flex-1"
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <Icon name="share" className="w-4 h-4" />
                  Gerar link de assinatura
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
