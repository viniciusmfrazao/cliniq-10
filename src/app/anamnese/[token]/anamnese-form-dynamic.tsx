'use client'

import { useState, useRef } from 'react'
import { parseDateBR, isoFromBR } from '@/lib/datetime'
import { getGeolocation } from '@/lib/get-geolocation'

type TemplateField = {
  id: string
  secao: string
  ordem: number
  label: string
  tipo: 'texto_curto' | 'texto_longo' | 'sim_nao' | 'single_select' | 'multi_select' | 'numero' | 'data'
  opcoes: string[] | null
  obrigatorio: boolean
  ativo: boolean
  condicao_campo_id: string | null
  condicao_valor: string | null
}

type Template = {
  id: string
  nome: string
  descricao: string | null
  cor_primaria: string
  campos_identificacao: string[]
}

type AnamneseData = {
  id: string
  patients: {
    name: string
    email: string | null
    phone: string | null
    cpf: string | null
    birth_date: string | null
  }
  clinics: { name: string }
  status: string
  completed_at?: string | null
  consent_term_text?: string | null
}

function fillConsentVariables(content: string, vars: Record<string, string>): string {
  return content
    .replace(/\{\{([\w_]+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
    .replace(/\{([\w_]+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export default function AnamneseFormDynamic({
  token,
  anamnese,
  template,
  fields,
}: {
  token: string
  anamnese: AnamneseData
  template: Template
  fields: TemplateField[]
}) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [consentScrolledToEnd, setConsentScrolledToEnd] = useState(false)
  const [responses, setResponses] = useState<Record<string, any>>({})

  const [cpfInput, setCpfInput] = useState('')
  const [birthDateInput, setBirthDateInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [emailInput, setEmailInput] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const camposIdAtivos = template.campos_identificacao?.length
    ? template.campos_identificacao
    : ['data_nascimento', 'cpf']

  const cor = template.cor_primaria || '#b89a6a'
  const secoes = Array.from(new Set(fields.map((f) => f.secao)))

  function setResponse(fieldId: string, value: any) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }))
  }

  // Uma pergunta condicional só aparece se a pergunta-pai tiver a resposta
  // configurada (condicao_valor)
  function campoVisivel(f: TemplateField): boolean {
    if (!f.condicao_campo_id) return true
    const valorPai = responses[f.condicao_campo_id]
    if (valorPai === undefined || valorPai === null) return false
    if (Array.isArray(valorPai)) return valorPai.includes(f.condicao_valor)
    return String(valorPai) === f.condicao_valor
  }

  // ===== Assinatura (canvas) =====
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvas)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1410'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSubmit = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const faltando: string[] = []
    let birthDateIso: string | null = null

    if (camposIdAtivos.includes('data_nascimento') && !anamnese.patients.birth_date) {
      birthDateIso = isoFromBR(birthDateInput)
      if (!birthDateIso) faltando.push('Data de nascimento')
    } else if (birthDateInput) {
      birthDateIso = isoFromBR(birthDateInput)
      if (!birthDateIso) faltando.push('Data de nascimento (formato inválido)')
    }

    if (camposIdAtivos.includes('cpf') && !anamnese.patients.cpf) {
      const cpfDigits = cpfInput.replace(/\D/g, '')
      if (cpfDigits.length !== 11) faltando.push('CPF')
    }

    for (const f of fields) {
      if (!f.obrigatorio || !campoVisivel(f)) continue
      const v = responses[f.id]
      const vazio = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
      if (vazio) faltando.push(f.label)
    }

    if (faltando.length > 0) {
      alert(`Antes de assinar, preencha:\n\n${faltando.map((f) => `• ${f}`).join('\n')}`)
      return
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const isEmpty = !imageData.data.some((channel, i) => (i % 4 !== 3 ? channel !== 0 : channel !== 0))
    if (isEmpty) {
      alert('Por favor, assine antes de enviar')
      return
    }

    setSubmitting(true)
    try {
      const signature = canvas.toDataURL('image/png')
      const geo = await getGeolocation()

      const res = await fetch(`/api/anamnese/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          signature,
          identificacao: {
            cpf: cpfInput.trim() || null,
            birth_date: birthDateIso,
            phone: phoneInput.trim() || null,
            email: emailInput.trim() || null,
          },
          lat: geo?.lat ?? null,
          lon: geo?.lon ?? null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao enviar')
      }
      setSuccess(true)
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar ficha')
    } finally {
      setSubmitting(false)
    }
  }

  if (!success && anamnese.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f5f0' }}>
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1a1410', fontFamily: 'Cormorant Garamond, serif' }}>
            Ficha já assinada
          </h1>
          <p style={{ color: '#8a7a6a' }}>
            Esta ficha de anamnese já foi preenchida e assinada
            {anamnese.completed_at
              ? ` em ${new Date(anamnese.completed_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
              : ''}.
          </p>
          <p style={{ color: '#8a7a6a' }} className="mt-1">
            Se precisar alterar alguma informação, entre em contato com a clínica.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f5f0' }}>
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1a1410', fontFamily: 'Cormorant Garamond, serif' }}>
            Ficha enviada com sucesso!
          </h1>
          <p style={{ color: '#8a7a6a' }}>Obrigado por preencher sua ficha de anamnese.</p>
        </div>
      </div>
    )
  }

  if (showConsent) {
    const today = new Date()
    const vars: Record<string, string> = {
      PACIENTE_NOME: anamnese.patients.name || '',
      DATA: today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      HORA: today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      CLINICA_NOME: anamnese.clinics.name || '',
    }
    const consentText = fillConsentVariables(anamnese.consent_term_text || '', vars)

    return (
      <div className="min-h-screen p-4" style={{ background: '#f9f5f0' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6 pt-8">
            <h2 className="text-2xl mb-2" style={{ color: '#1a1410', fontFamily: 'Cormorant Garamond, serif' }}>
              Termo de Consentimento
            </h2>
            <p style={{ color: '#8a7a6a', fontSize: '14px' }}>Leia atentamente até o final antes de continuar</p>
          </div>

          <div
            className="rounded-lg p-5 mb-4 whitespace-pre-wrap text-sm leading-relaxed"
            style={{ background: '#fffdf9', border: '1px solid #e0d5c5', maxHeight: '50vh', overflowY: 'auto', color: '#4a3f35' }}
            onScroll={(e) => {
              const el = e.currentTarget
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setConsentScrolledToEnd(true)
            }}
          >
            {consentText}
          </div>

          {!consentScrolledToEnd && (
            <p className="text-center text-xs mb-3" style={{ color: '#b89a6a' }}>
              Role o texto até o final para habilitar o botão de continuar
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowConsent(false)}
              className="flex-1 py-3 rounded text-sm font-medium"
              style={{ background: '#f5ede0', color: '#4a3f35' }}
            >
              Voltar
            </button>
            <button
              onClick={() => { setShowConsent(false); setShowSignature(true) }}
              disabled={!consentScrolledToEnd}
              className="flex-1 py-3 rounded text-sm font-medium transition-all"
              style={{ background: consentScrolledToEnd ? '#1a1410' : '#c9bdae', color: '#f9f5f0' }}
            >
              Li e concordo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showSignature) {
    return (
      <div className="min-h-screen p-4" style={{ background: '#f9f5f0' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6 pt-8">
            <h2 className="text-2xl mb-2" style={{ color: '#1a1410', fontFamily: 'Cormorant Garamond, serif' }}>
              Assinatura Digital
            </h2>
            <p style={{ color: '#8a7a6a', fontSize: '14px' }}>Desenhe sua assinatura no campo abaixo</p>
          </div>

          <div className="rounded-lg p-4 mb-4" style={{ background: '#fffdf9', border: '1px solid #e0d5c5' }}>
            <canvas
              ref={canvasRef}
              width={350}
              height={200}
              className="w-full rounded cursor-crosshair touch-none"
              style={{ background: '#fff', border: '1px solid #e0d5c5' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <button onClick={clearSignature} className="mt-3 px-4 py-2 text-sm rounded" style={{ background: '#f5ede0', color: '#4a3f35' }}>
              Limpar assinatura
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSignature(false)
                if (anamnese.consent_term_text) setShowConsent(true)
              }}
              className="flex-1 py-3 rounded text-sm font-medium"
              style={{ background: '#f5ede0', color: '#4a3f35' }}
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded text-sm font-medium transition-all"
              style={{ background: submitting ? '#8a7a6a' : '#1a1410', color: '#f9f5f0' }}
            >
              {submitting ? 'Enviando...' : 'Enviar Ficha'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCampo(f: TemplateField) {
    if (!campoVisivel(f)) return null
    const value = responses[f.id]

    return (
      <div key={f.id} className="py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>
          {f.label} {f.obrigatorio && <span style={{ color: 'var(--gold)' }}>*</span>}
        </p>

        {f.tipo === 'sim_nao' && (
          <div className="flex gap-3">
            {['Sim', 'Não'].map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setResponse(f.id, opt)}
                className="px-5 py-2 rounded-full text-sm border transition-colors"
                style={{
                  borderColor: value === opt ? cor : 'var(--border)',
                  background: value === opt ? cor : 'transparent',
                  color: value === opt ? '#fff' : 'var(--mid)',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {f.tipo === 'texto_curto' && (
          <input
            type="text"
            className="anamnese-input w-full"
            value={value || ''}
            onChange={(e) => setResponse(f.id, e.target.value)}
          />
        )}

        {f.tipo === 'texto_longo' && (
          <textarea
            className="anamnese-input w-full"
            rows={3}
            value={value || ''}
            onChange={(e) => setResponse(f.id, e.target.value)}
          />
        )}

        {f.tipo === 'numero' && (
          <input
            type="number"
            className="anamnese-input"
            value={value ?? ''}
            onChange={(e) => setResponse(f.id, e.target.value)}
          />
        )}

        {f.tipo === 'data' && (
          <input
            type="text"
            inputMode="numeric"
            placeholder="00/00/0000"
            className="anamnese-input"
            style={{ maxWidth: 160 }}
            value={value || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8)
              const fmt = v.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2')
              setResponse(f.id, fmt)
            }}
            maxLength={10}
          />
        )}

        {f.tipo === 'single_select' && (
          <div className="flex flex-wrap gap-2">
            {(f.opcoes || []).map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setResponse(f.id, opt)}
                className="px-4 py-2 rounded-full text-sm border transition-colors"
                style={{
                  borderColor: value === opt ? cor : 'var(--border)',
                  background: value === opt ? cor : 'transparent',
                  color: value === opt ? '#fff' : 'var(--mid)',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {f.tipo === 'multi_select' && (
          <div className="flex flex-wrap gap-2">
            {(f.opcoes || []).map((opt) => {
              const selected = Array.isArray(value) && value.includes(opt)
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    const arr: string[] = Array.isArray(value) ? value : []
                    setResponse(f.id, selected ? arr.filter((v) => v !== opt) : [...arr, opt])
                  }}
                  className="px-4 py-2 rounded-full text-sm border transition-colors"
                  style={{
                    borderColor: selected ? cor : 'var(--border)',
                    background: selected ? cor : 'transparent',
                    color: selected ? '#fff' : 'var(--mid)',
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root {
          --cream: #f9f5f0;
          --warm-white: #fffdf9;
          --gold: #b89a6a;
          --dark: #1a1410;
          --mid: #4a3f35;
          --light-text: #8a7a6a;
          --border: #e0d5c5;
        }
        .anamnese-input {
          padding: 10px 14px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--warm-white);
          font-size: 14px;
          color: var(--dark);
          min-width: 170px;
        }
        .anamnese-input:focus {
          border-color: var(--gold);
          background: var(--warm-white);
          outline: none;
        }
      `}</style>

      <div className="min-h-screen p-5 pb-20" style={{ background: 'var(--cream)' }}>
        <div className="max-w-3xl mx-auto">
          <header className="text-center py-12 border-b mb-12" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs tracking-widest uppercase mb-3" style={{ color: cor }}>
              {anamnese.clinics.name || 'Clínica Estética'}
            </div>
            <h1 className="text-4xl font-light leading-tight" style={{ color: 'var(--dark)' }}>
              {template.nome}
            </h1>
            {template.descricao && (
              <p className="mt-2 text-sm" style={{ color: 'var(--light-text)' }}>{template.descricao}</p>
            )}
            <div className="flex items-center justify-center gap-4 mt-5">
              <div className="w-16 h-px" style={{ background: cor, opacity: 0.5 }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
              <div className="w-16 h-px" style={{ background: cor, opacity: 0.5 }} />
            </div>

            <div className="mt-6 p-4 rounded text-left" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--light-text)' }}>
                Paciente: <strong style={{ color: 'var(--dark)' }}>{anamnese.patients.name}</strong>
              </p>

              {camposIdAtivos.includes('data_nascimento') && (
                anamnese.patients.birth_date ? (
                  <div className="mt-3">
                    <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                      Data de nascimento <span style={{ fontSize: '11px', color: '#b89a6a' }}>(confirme ou corrija)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="anamnese-input"
                      placeholder="00/00/0000"
                      defaultValue={parseDateBR(anamnese.patients.birth_date)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                        const fmt = v.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2')
                        setBirthDateInput(fmt)
                      }}
                      maxLength={10}
                      style={{ maxWidth: 160 }}
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                      Data de nascimento <span style={{ color: '#b89a6a' }}>*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="anamnese-input"
                      placeholder="00/00/0000"
                      value={birthDateInput}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                        const fmt = v.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2')
                        setBirthDateInput(fmt)
                      }}
                      maxLength={10}
                      style={{ maxWidth: 160 }}
                    />
                  </div>
                )
              )}

              {camposIdAtivos.includes('cpf') && !anamnese.patients.cpf && (
                <div className="mt-3">
                  <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                    CPF <span style={{ color: '#b89a6a' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="anamnese-input"
                    placeholder="000.000.000-00"
                    value={cpfInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                      const fmt = v
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                      setCpfInput(fmt)
                    }}
                    maxLength={14}
                    style={{ maxWidth: 200 }}
                  />
                </div>
              )}

              {camposIdAtivos.includes('telefone') && !anamnese.patients.phone && (
                <div className="mt-3">
                  <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>Telefone</label>
                  <input
                    type="text"
                    className="anamnese-input"
                    placeholder="(00) 00000-0000"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                </div>
              )}

              {camposIdAtivos.includes('email') && !anamnese.patients.email && (
                <div className="mt-3">
                  <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>E-mail</label>
                  <input
                    type="email"
                    className="anamnese-input"
                    placeholder="voce@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    style={{ maxWidth: 240 }}
                  />
                </div>
              )}
            </div>
          </header>

          {secoes.map((secao) => (
            <section key={secao} className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs tracking-widest uppercase pb-3 mb-2 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
                {secao}
              </h2>
              {fields.filter((f) => f.secao === secao).map(renderCampo)}
            </section>
          ))}

          <div className="text-center mt-10">
            <button
              onClick={() => {
                if (anamnese.consent_term_text) setShowConsent(true)
                else setShowSignature(true)
              }}
              className="px-10 py-4 rounded text-sm font-medium tracking-wide uppercase"
              style={{ background: 'var(--dark)', color: 'var(--cream)' }}
            >
              Revisar e assinar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
