'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

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
  patients: Patient[]
  userId: string
  preSelectedPatient?: string
}

export default function SendAnamneseForm({ clinicId, clinicName, patients, userId, preSelectedPatient }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [searchPatient, setSearchPatient] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (preSelectedPatient) {
      const patient = patients.find(p => p.id === preSelectedPatient)
      if (patient) {
        setSelectedPatient(patient)
      }
    }
  }, [preSelectedPatient, patients])

  const generateToken = () => {
    return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
  }

  const handleSubmit = async () => {
    if (!selectedPatient) return
    setLoading(true)

    try {
      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data, error } = await supabase
        .from('anamneses')
        .insert({
          clinic_id: clinicId,
          patient_id: selectedPatient.id,
          status: 'pending',
          sent_by: userId,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      const signUrl = `${window.location.origin}/anamnese/${token}`
      setGeneratedLink(signUrl)
      setShowSuccessModal(true)
    } catch (error) {
      console.error(error)
      alert('Erro ao criar ficha de anamnese')
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

  const sendWhatsApp = () => {
    const phone = selectedPatient?.phone?.replace(/\D/g, '') || ''
    const message = encodeURIComponent(
      `Olá ${selectedPatient?.name}!\n\nSegue o link para preencher sua ficha de anamnese da ${clinicName}:\n\n${generatedLink}\n\nO link expira em 7 dias.`
    )
    const whatsappUrl = phone 
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`
    window.open(whatsappUrl, '_blank')
  }

  const closeModal = () => {
    setShowSuccessModal(false)
    router.push('/dashboard/anamnese')
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Icon name="check" className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ficha criada!</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Link de anamnese gerado para <strong>{selectedPatient?.name}</strong>
              </p>
            </div>

            {/* Link display */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Link para preenchimento:</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 break-all font-mono">{generatedLink}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={copyLink}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <Icon name={copied ? 'check' : 'clipboard'} className="w-5 h-5" />
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button
                onClick={sendWhatsApp}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
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
              className="w-full py-3 rounded-xl font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Selected patient */}
        {selectedPatient ? (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-semibold text-lg">
              {selectedPatient.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">{selectedPatient.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedPatient.phone || selectedPatient.email || 'Sem contato'}</p>
            </div>
            <button
              onClick={() => setSelectedPatient(null)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Selecione o paciente</h3>
            <div className="relative mb-4">
              <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchPatient}
                onChange={e => setSearchPatient(e.target.value)}
                placeholder="Buscar paciente..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-700 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredPatients.length === 0 ? (
                <p className="text-center text-slate-500 py-4">Nenhum paciente encontrado</p>
              ) : (
                filteredPatients.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-semibold">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{patient.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{patient.email || patient.phone || '-'}</p>
                    </div>
                    <Icon name="chevronRight" className="w-5 h-5 text-slate-300" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <Icon name="file" className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Ficha de Anamnese Facial</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Um link será gerado para o paciente preencher a ficha de anamnese com design elegante. 
                Você poderá enviar por WhatsApp ou copiar o link. O link expira em 7 dias.
              </p>
            </div>
          </div>
        </div>

        {/* Submit button */}
        {selectedPatient && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                <Icon name="share" className="w-5 h-5" />
                Gerar link de anamnese
              </>
            )}
          </button>
        )}
      </div>
    </>
  )
}
