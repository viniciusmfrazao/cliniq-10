'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Template = {
  id: string
  name: string
  content: string
  category: string
  theme_color?: string
}

type Patient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpf: string | null
}

type Professional = {
  id: string
  name: string
  professional_registration: string | null
}

type Props = {
  clinicId: string
  clinicName: string
  templates: Template[]
  patients: Patient[]
  userId: string
  userName?: string
  userRegistration?: string
  professionals?: Professional[]
  preSelectedPatient?: string
  appointmentId?: string
}

export default function SendDocumentForm({ clinicId, clinicName, templates, patients, userId, userName, userRegistration, professionals = [], preSelectedPatient, appointmentId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [content, setContent] = useState('')
  const [signerRole, setSignerRole] = useState<'paciente' | 'profissional'>('paciente')
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    professionals.find(p => p.id === userId)?.id || professionals[0]?.id || ''
  )
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasProfSignature, setHasProfSignature] = useState(false)

  const signingProfessional = professionals.length > 0
    ? (professionals.find(p => p.id === selectedProfessionalId) || null)
    : { id: userId, name: userName || '', professional_registration: userRegistration || null }
  const [searchPatient, setSearchPatient] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [generatedDocId, setGeneratedDocId] = useState('')
  const [copied, setCopied] = useState(false)
  const [sendingWA, setSendingWA] = useState(false)

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

  useEffect(() => {
    if (signerRole !== 'profissional' || step !== 3) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [signerRole, step])

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const { x, y } = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPosition(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasProfSignature(true)
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearProfSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasProfSignature(false)
  }

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    setSignerRole('paciente')
    setHasProfSignature(false)
    
    // Se for anamnese, não precisa editar conteúdo - vai direto para confirmação
    if (template.category === 'anamnese') {
      setContent('ANAMNESE_FORM')
      setStep(3)
      return
    }
    
    const now = new Date()
    let processedContent = template.content
      .replace(/\{\{PACIENTE_NOME\}\}/g, selectedPatient?.name || '')
      .replace(/\{\{PACIENTE_CPF\}\}/g, selectedPatient?.cpf || '')
      .replace(/\{\{PACIENTE_EMAIL\}\}/g, selectedPatient?.email || '')
      .replace(/\{\{PACIENTE_TELEFONE\}\}/g, selectedPatient?.phone || '')
      .replace(/\{\{DATA\}\}/g, now.toLocaleDateString('pt-BR'))
      .replace(/\{\{HORA\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }))
      .replace(/\{\{CLINICA_NOME\}\}/g, clinicName)
    setContent(processedContent)
    setStep(3)
  }

  const generateToken = () => {
    return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
  }

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedTemplate) return
    if (selectedTemplate.category !== 'anamnese' && signerRole === 'profissional' && !hasProfSignature) return
    if (selectedTemplate.category !== 'anamnese' && signerRole === 'profissional' && !signingProfessional?.id) return
    setLoading(true)

    try {
      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      let signUrl: string

      // Se for anamnese, usa tabela anamneses
      if (selectedTemplate.category === 'anamnese') {
        const { error } = await supabase
          .from('anamneses')
          .insert({
            clinic_id: clinicId,
            patient_id: selectedPatient.id,
            status: 'pending',
            sent_by: userId,
            token,
            expires_at: expiresAt.toISOString(),
          })

        if (error) throw error
        signUrl = `${window.location.origin}/anamnese/${token}`
      } else if (signerRole === 'profissional') {
        // Assinado pela profissional na hora — endpoint captura IP/UA no
        // servidor (mesmo conjunto probatorio usado na assinatura do paciente)
        // e documento ja sai "signed", sem pendencia pro paciente
        const profSignature = canvasRef.current?.toDataURL('image/png') || ''
        const res = await fetch('/api/documento/sign-as-professional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: selectedTemplate.id,
            patientId: selectedPatient.id,
            appointmentId: appointmentId || null,
            name: selectedTemplate.name,
            content,
            signature: profSignature,
            signerUserId: signingProfessional?.id || null,
          }),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'erro_ao_assinar')
        setGeneratedDocId(data.id)
        signUrl = `${window.location.origin}/assinar/${data.token}`
      } else {
        // Documento normal — paciente assina
        const { data: sentDoc, error } = await supabase
          .from('documents_sent')
          .insert({
            clinic_id: clinicId,
            template_id: selectedTemplate.id,
            patient_id: selectedPatient.id,
            appointment_id: appointmentId || null,
            name: selectedTemplate.name,
            content,
            status: 'pending',
            signer_role: 'paciente',
            sent_by: userId,
            sign_token: token,
            expires_at: expiresAt.toISOString(),
          })
          .select('id')
          .single()

        if (error) throw error
        setGeneratedDocId(sentDoc?.id || '')
        signUrl = `${window.location.origin}/assinar/${token}`
      }

      setGeneratedLink(signUrl)
      setShowSuccessModal(true)
    } catch (error) {
      console.error(error)
      alert('Erro ao enviar documento')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      const input = document.createElement('input')
      input.value = generatedLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sendWhatsApp = async () => {
    if (!generatedDocId) return
    setSendingWA(true)
    try {
      const res = await fetch('/api/documento/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: generatedDocId }),
      })
      const data = await res.json()
      if (data.ok) {
        alert('Documento enviado pelo WhatsApp da clínica! ✅')
      } else {
        // Fallback: WhatsApp Web
        const phone = selectedPatient?.phone?.replace(/\D/g, '') || ''
        const isProfSigned = signerRole === 'profissional' && selectedTemplate?.category !== 'anamnese'
        const message = encodeURIComponent(
          isProfSigned
            ? `Olá ${selectedPatient?.name}!\n\nSegue o documento "${selectedTemplate?.name}" já assinado:\n\n${generatedLink}\n\nO link expira em 7 dias.`
            : `Olá ${selectedPatient?.name}!\n\nSegue o link para assinar o documento "${selectedTemplate?.name}":\n\n${generatedLink}\n\nO link expira em 7 dias.`
        )
        window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
      }
    } catch {
      alert('Erro ao enviar. Tente novamente.')
    } finally {
      setSendingWA(false)
    }
  }

  const closeModal = () => {
    setShowSuccessModal(false)
    router.push('/dashboard/documentos')
    router.refresh()
  }

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.phone?.includes(searchPatient)
  )

  return (
    <>
    {/* Success Modal */}
    {showSuccessModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <Icon name="check" className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {signerRole === 'profissional' && selectedTemplate?.category !== 'anamnese' ? 'Documento assinado!' : 'Documento enviado!'}
            </h2>
            <p className="text-sm text-slate-600">
              {signerRole === 'profissional' && selectedTemplate?.category !== 'anamnese'
                ? <>Link do documento já assinado, pronto para <strong>{selectedPatient?.name}</strong></>
                : <>Link de assinatura gerado para <strong>{selectedPatient?.name}</strong></>}
            </p>
          </div>

          {/* Link display */}
          <div className="bg-slate-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-slate-500 mb-1">
              {signerRole === 'profissional' && selectedTemplate?.category !== 'anamnese' ? 'Link do documento:' : 'Link para assinatura:'}
            </p>
            <p className="text-sm text-slate-700 break-all font-mono">{generatedLink}</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={copyLink}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                copied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon name={copied ? 'check' : 'clipboard'} className="w-5 h-5" />
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <button
              onClick={sendWhatsApp}
              disabled={sendingWA}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-60"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={closeModal}
            className="w-full py-3 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    )}

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
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
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
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors text-left"
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: template.theme_color || 'var(--color-primary)' }}
                    >
                      <Icon name={template.category === 'anamnese' ? 'clipboard' : 'file'} className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{template.name}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {template.category === 'anamnese' ? 'Ficha de Anamnese' : template.category}
                      </p>
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
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ background: selectedTemplate?.theme_color || 'var(--color-primary)' }}
            >
              {selectedPatient?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">{selectedPatient?.name}</p>
              <p className="text-sm text-slate-500">{selectedTemplate?.name}</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Alterar
            </button>
          </div>

          {selectedTemplate?.category === 'anamnese' ? (
            <div 
              className="rounded-xl p-8 border-2"
              style={{ 
                borderColor: selectedTemplate?.theme_color || '#b89a6a',
                background: `${selectedTemplate?.theme_color || '#b89a6a'}10`
              }}
            >
              <div className="text-center">
                <div 
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{ background: selectedTemplate?.theme_color || '#b89a6a' }}
                >
                  <Icon name="clipboard" className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Ficha de Anamnese</h3>
                <p className="text-slate-500 mb-4">
                  Um link será gerado com um formulário elegante para <strong>{selectedPatient?.name}</strong> preencher.
                </p>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>O formulário inclui:</p>
                  <p>• Procedimentos anteriores</p>
                  <p>• Hábitos de vida e alergias</p>
                  <p>• Medicamentos em uso</p>
                  <p>• Saúde geral e queixas</p>
                  <p>• Assinatura digital</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card p-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Conteudo do documento</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow] font-mono text-sm resize-none"
                  rows={15}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Voce pode editar o conteudo antes de enviar
                </p>
              </div>

              <div className="card p-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Quem assina?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSignerRole('paciente')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      signerRole === 'paciente'
                        ? 'bg-violet-500 border-violet-500 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignerRole('profissional')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      signerRole === 'profissional'
                        ? 'bg-violet-500 border-violet-500 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    Profissional
                  </button>
                </div>

                {signerRole === 'profissional' && (
                  <div className="mt-4">
                    {professionals.length > 0 && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Quem está assinando</label>
                        <select
                          value={selectedProfessionalId}
                          onChange={e => setSelectedProfessionalId(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                        >
                          {professionals.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.professional_registration ? ` — ${p.professional_registration}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                      Assinatura eletrônica simples — válida como atestado/orientação assinada por {signingProfessional?.name || 'você'}.
                      Não tem validade como receita de medicamento controlado (exige certificado ICP-Brasil).
                    </p>
                    {!signingProfessional?.professional_registration && (
                      <p className="text-xs text-slate-400 mb-3">
                        Sem CRM/CRO cadastrado. Adicione em{' '}
                        <a href="/dashboard/equipe" className="text-[var(--color-primary)] hover:underline">Equipe</a> pra aparecer no documento.
                      </p>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        Assinatura{signingProfessional?.name ? ` — ${signingProfessional.name}` : ''}{signingProfessional?.professional_registration ? ` (${signingProfessional.professional_registration})` : ''}
                      </span>
                      {hasProfSignature && (
                        <button type="button" onClick={clearProfSignature} className="text-xs text-slate-500 hover:text-slate-700">
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        className="w-full h-40 cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">Desenhe sua assinatura acima</p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="btn-secondary flex-1"
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (selectedTemplate?.category !== 'anamnese' && signerRole === 'profissional' && !hasProfSignature)}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <Icon name="share" className="w-4 h-4" />
                  {selectedTemplate?.category !== 'anamnese' && signerRole === 'profissional' ? 'Assinar e enviar' : 'Gerar link de assinatura'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
