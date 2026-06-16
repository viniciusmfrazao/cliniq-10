'use client'

import { useState, useEffect, useRef } from 'react'
import { parseDateBR } from '@/lib/datetime'

type AnamneseConfig = {
  titulo?: string
  subtitulo?: string
  cor_primaria?: string
  secoes_ativas?: string[]
  perguntas_extras?: Array<{ secao: string; pergunta: string; tipo: 'sim_nao'|'texto'|'multipla'; opcoes?: string }>
}

type AnamneseData = {
  id: string
  clinic_id: string
  patient_id: string
  status: string
  patients: {
    name: string
    email: string | null
    phone: string | null
    cpf: string | null
    birth_date: string | null
  }
  clinics: {
    name: string
  }
  anamnese_config: AnamneseConfig | null
}

export default function AnamneseFormClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [anamnese, setAnamnese] = useState<AnamneseData | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showSignature, setShowSignature] = useState(false)

  // Form state — autosave no localStorage
  const DRAFT_KEY = `anamnese_draft_${token}`
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [hasDraft, setHasDraft] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Campos de identificação que o paciente pode preencher (se vazios no cadastro)
  const [cpfInput, setCpfInput] = useState('')
  const [birthDateInput, setBirthDateInput] = useState('')

  // Restaurar rascunho ao montar (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && Object.keys(parsed).length > 0) {
          setResponses(parsed)
          setHasDraft(true)
        }
      }
    } catch (e) {
      console.warn('autosave restore error:', e)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAnamnese()
  }, [token])

  const fetchAnamnese = async () => {
    try {
      const res = await fetch(`/api/anamnese/${token}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao carregar')
      }
      const data = await res.json()
      setAnamnese(data)
    } catch (err: any) {
      setError(err.message || 'Ficha não encontrada')
    } finally {
      setLoading(false)
    }
  }

  const selectSingle = (group: string, value: string) => {
    setResponses(prev => {
      const next = { ...prev, [group]: value }
      try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const saveToStorage = (data: Record<string, any>) => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch {}
  }

  const selectMulti = (group: string, value: string) => {
    setResponses(prev => {
      const current = prev[group] || []
      const next = current.includes(value)
        ? { ...prev, [group]: current.filter((v: string) => v !== value) }
        : { ...prev, [group]: [...current, value] }
      saveToStorage(next)
      return next
    })
  }

  const setSingleValue = (key: string, val: string) => setResponses(prev => ({ ...prev, [key]: val }))

  const setTextValue = (field: string, value: string) => {
    setResponses(prev => {
      const next = { ...prev, [field]: value }
      saveToStorage(next)
      return next
    })
  }

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1a1410'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

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

    // Check if signature is empty
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const isEmpty = !imageData.data.some((channel, i) => i % 4 !== 3 ? channel !== 0 : channel !== 0)
    
    if (isEmpty) {
      alert('Por favor, assine antes de enviar')
      return
    }

    setSubmitting(true)

    try {
      const signature = canvas.toDataURL('image/png')
      
      const res = await fetch(`/api/anamnese/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          signature,
          identificacao: {
            cpf: cpfInput.trim() || null,
            birth_date: birthDateInput || null,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao enviar')
      }

      // Limpar rascunho após envio com sucesso
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      setHasDraft(false)
      setSuccess(true)
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar ficha')
    } finally {
      setSubmitting(false)
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    setHasDraft(false)
    setResponses({})
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f5f0' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#b89a6a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p style={{ color: '#4a3f35', fontFamily: 'Jost, sans-serif' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f5f0' }}>
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fee2e2' }}>
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: '#1a1410' }}>{error}</h1>
          <p style={{ color: '#8a7a6a' }}>O link pode estar expirado ou inválido.</p>
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

  if (showSignature) {
    return (
      <div className="min-h-screen p-4" style={{ background: '#f9f5f0' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6 pt-8">
            <h2 className="text-2xl mb-2" style={{ color: '#1a1410', fontFamily: 'Cormorant Garamond, serif' }}>
              Assinatura Digital
            </h2>
            <p style={{ color: '#8a7a6a', fontSize: '14px' }}>
              Desenhe sua assinatura no campo abaixo
            </p>
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
            <button
              onClick={clearSignature}
              className="mt-3 px-4 py-2 text-sm rounded"
              style={{ background: '#f5ede0', color: '#4a3f35' }}
            >
              Limpar assinatura
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSignature(false)}
              className="flex-1 py-3 rounded text-sm font-medium"
              style={{ background: '#f5ede0', color: '#4a3f35' }}
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded text-sm font-medium transition-all"
              style={{ 
                background: submitting ? '#8a7a6a' : '#1a1410', 
                color: '#f9f5f0',
              }}
            >
              {submitting ? 'Enviando...' : 'Enviar Ficha'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cfg = anamnese?.anamnese_config
  const cor = cfg?.cor_primaria || '#b89a6a'
  const titulo = cfg?.titulo || 'Ficha de Anamnese Facial'
  const subtitulo = cfg?.subtitulo || ''
  const secoesAtivas = cfg?.secoes_ativas || ['procedimentos','habitos','alergias','medicamentos','saude','outras','mulheres','queixa']
  const perguntasExtras = cfg?.perguntas_extras || []

  // Helper: retorna perguntas extras vinculadas a uma seção específica
  const extrasDaSecao = (secaoId: string) =>
    perguntasExtras.filter((p: any) => p.secao === secaoId)

  // Renderiza as perguntas extras de uma seção
  const renderExtras = (secaoId: string) => {
    const extras = extrasDaSecao(secaoId)
    if (extras.length === 0) return null
    return (
      <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
        {extras.map((p: any, i: number) => {
          // Índice global para manter as chaves de resposta consistentes
          const idx = perguntasExtras.indexOf(p)
          return (
            <div key={idx} className="mb-6">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>{p.pergunta}</p>
              {p.tipo === 'sim_nao' && (
                <div className="flex gap-3 flex-wrap">
                  {['Sim', 'Não'].map(opt => (
                    <Choice key={opt} group={`extra_${idx}`} value={opt}
                      selected={responses[`extra_${idx}`] === opt}
                      onClick={() => setSingleValue(`extra_${idx}`, opt)} />
                  ))}
                </div>
              )}
              {p.tipo === 'texto' && (
                <textarea className="anamnese-input" rows={3}
                  placeholder="Sua resposta..."
                  value={responses[`extra_${idx}`] || ''}
                  onChange={e => setTextValue(`extra_${idx}`, e.target.value)} />
              )}
              {p.tipo === 'multipla' && p.opcoes && (
                <div className="flex gap-3 flex-wrap">
                  {p.opcoes.split(',').map((opt: string) => opt.trim()).filter(Boolean).map((opt: string) => (
                    <Choice key={opt} group={`extra_${idx}`} value={opt} type="multi"
                      selected={(responses[`extra_${idx}`] || '').includes(opt)}
                      onClick={() => {
                        const cur = responses[`extra_${idx}`] || ''
                        const arr = cur ? cur.split(',').map((s: string) => s.trim()) : []
                        const next = arr.includes(opt) ? arr.filter((s: string) => s !== opt) : [...arr, opt]
                        setTextValue(`extra_${idx}`, next.join(', '))
                      }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const Choice = ({ group, value, selected, onClick, type = 'single' }: any) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm transition-all"
      style={{
        border: `1px solid ${selected ? '#b89a6a' : '#e0d5c5'}`,
        background: selected ? '#f5ede0' : '#f9f5f0',
        color: selected ? '#1a1410' : '#8a7a6a',
      }}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{ border: `1px solid ${selected ? '#b89a6a' : 'currentColor'}`, background: selected ? '#b89a6a' : 'transparent' }}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      {value}
    </button>
  )

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap');
        
        .anamnese-page {
          --cream: #f9f5f0;
          --warm-white: #fffdf9;
          --gold: #b89a6a;
          --gold-light: #d4b98a;
          --dark: #1a1410;
          --mid: #4a3f35;
          --light-text: #8a7a6a;
          --border: #e0d5c5;
          --selected-bg: #f5ede0;
        }
        
        html, body {
          overflow-y: auto !important;
          overscroll-behavior-y: auto !important;
          height: auto !important;
        }
        
        .anamnese-page * {
          font-family: 'Jost', sans-serif;
        }
        
        .anamnese-page h1, .anamnese-page h2, .anamnese-page .section-title {
          font-family: 'Cormorant Garamond', serif;
        }
        
        .anamnese-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 2px;
          background: var(--cream);
          font-size: 13px;
          color: var(--dark);
          outline: none;
          transition: border-color 0.2s;
        }
        
        .anamnese-input:focus {
          border-color: var(--gold);
          background: var(--warm-white);
        }
        
        .anamnese-input::placeholder {
          color: #bbb;
        }
      `}</style>

      <div className="anamnese-page min-h-screen p-5 pb-20" style={{ background: 'var(--cream)' }}>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center py-12 border-b mb-12" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs tracking-widest uppercase mb-3" style={{ color: cor }}>
              {anamnese?.clinics.name || 'Clínica Estética'}
            </div>
            <h1 className="text-4xl font-light leading-tight" style={{ color: 'var(--dark)' }}>
              Ficha de Anamnese<br />Facial
            </h1>
            <div className="flex items-center justify-center gap-4 mt-5">
              <div className="w-16 h-px" style={{ background: cor, opacity: 0.5 }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
              <div className="w-16 h-px" style={{ background: cor, opacity: 0.5 }} />
            </div>
            {anamnese?.patients && (
              <div className="mt-6 p-4 rounded" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
                <p className="text-sm mb-2" style={{ color: 'var(--light-text)' }}>
                  Paciente: <strong style={{ color: 'var(--dark)' }}>{anamnese.patients.name}</strong>
                </p>
                {anamnese.patients.birth_date ? (
                  <div className="mt-3">
                    <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                      Data de nascimento <span style={{ fontSize: '11px', color: '#b89a6a' }}>(confirme ou corrija)</span>
                    </label>
                    <input
                      type="date"
                      className="anamnese-input"
                      defaultValue={anamnese.patients.birth_date.slice(0, 10)}
                      onChange={e => setBirthDateInput(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ maxWidth: '200px' }}
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                      Data de nascimento <span style={{ color: '#b89a6a' }}>*</span>
                    </label>
                    <input
                      type="date"
                      className="anamnese-input"
                      value={birthDateInput}
                      onChange={e => setBirthDateInput(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ maxWidth: '200px' }}
                    />
                  </div>
                )}
                {!anamnese.patients.cpf && (
                  <div className="mt-3">
                    <label className="text-sm block mb-1" style={{ color: 'var(--mid)' }}>
                      CPF <span style={{ color: '#b89a6a' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="anamnese-input"
                      placeholder="000.000.000-00"
                      value={cpfInput}
                      onChange={e => {
                        // Formata CPF automaticamente
                        const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                        const fmt = v
                          .replace(/(\d{3})(\d)/, '$1.$2')
                          .replace(/(\d{3})(\d)/, '$1.$2')
                          .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                        setCpfInput(fmt)
                      }}
                      maxLength={14}
                      style={{ maxWidth: '200px' }}
                    />
                  </div>
                )}
              </div>
            )}
          </header>

          {/* PROCEDIMENTOS ANTERIORES */}
          {secoesAtivas.includes('procedimentos') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Procedimentos Anteriores
            </h2>

            <div className="mb-7">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Já fez procedimento com toxina botulínica (Botox)?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Choice group="botox" value="Não" selected={responses.botox === 'Não'} onClick={() => selectSingle('botox', 'Não')} />
                <Choice group="botox" value="Sim" selected={responses.botox === 'Sim'} onClick={() => selectSingle('botox', 'Sim')} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--light-text)' }}>Quando?</span>
                <input 
                  type="text" 
                  placeholder="ex: jan/2024" 
                  className="anamnese-input" 
                  style={{ width: '150px' }}
                  value={responses.botox_quando || ''}
                  onChange={e => setTextValue('botox_quando', e.target.value)}
                />
              </div>
            </div>

            <div className="h-px my-5" style={{ background: 'var(--border)' }} />

            <div className="mb-7">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Já fez procedimento com preenchimento facial?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Choice group="preench" value="Não" selected={responses.preench === 'Não'} onClick={() => selectSingle('preench', 'Não')} />
                <Choice group="preench" value="Sim" selected={responses.preench === 'Sim'} onClick={() => selectSingle('preench', 'Sim')} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm" style={{ color: 'var(--light-text)' }}>
                  Quando? <input type="text" placeholder="ex: 2023" className="anamnese-input ml-2" style={{ width: '100px' }} value={responses.preench_quando || ''} onChange={e => setTextValue('preench_quando', e.target.value)} />
                </span>
                <span className="text-sm" style={{ color: 'var(--light-text)' }}>
                  Com qual? <input type="text" placeholder="ex: ácido hialurônico" className="anamnese-input ml-2" style={{ width: '180px' }} value={responses.preench_qual || ''} onChange={e => setTextValue('preench_qual', e.target.value)} />
                </span>
              </div>
            </div>

            <div className="h-px my-5" style={{ background: 'var(--border)' }} />

            <div className="mb-7">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Já fez procedimento com Bioestimulador de Colágeno?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Choice group="bioestim" value="Não" selected={responses.bioestim === 'Não'} onClick={() => selectSingle('bioestim', 'Não')} />
                <Choice group="bioestim" value="Sim" selected={responses.bioestim === 'Sim'} onClick={() => selectSingle('bioestim', 'Sim')} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--light-text)' }}>Quando?</span>
                <input type="text" placeholder="ex: mar/2024" className="anamnese-input" style={{ width: '150px' }} value={responses.bioestim_quando || ''} onChange={e => setTextValue('bioestim_quando', e.target.value)} />
              </div>
            </div>

            <div className="h-px my-5" style={{ background: 'var(--border)' }} />

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Já teve experiências boas ou ruins com procedimentos?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Choice group="experiencia" value="Não" selected={responses.experiencia === 'Não'} onClick={() => selectSingle('experiencia', 'Não')} />
                <Choice group="experiencia" value="Sim" selected={responses.experiencia === 'Sim'} onClick={() => selectSingle('experiencia', 'Sim')} />
              </div>
              <textarea 
                className="anamnese-input" 
                placeholder="Me conte como foi sua experiência..." 
                rows={3}
                value={responses.experiencia_desc || ''}
                onChange={e => setTextValue('experiencia_desc', e.target.value)}
              />
            </div>
            {renderExtras('procedimentos')}
          </section>)}

          {/* HÁBITOS DE VIDA */}
          {secoesAtivas.includes('habitos') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Hábitos de Vida
            </h2>

            <div className="mb-7">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Atividade física</p>
              <div className="flex flex-col gap-2">
                <Choice group="atividade" value="0–3x / semana" selected={responses.atividade === '0–3x / semana'} onClick={() => selectSingle('atividade', '0–3x / semana')} />
                <Choice group="atividade" value="5–7x / semana" selected={responses.atividade === '5–7x / semana'} onClick={() => selectSingle('atividade', '5–7x / semana')} />
                <Choice group="atividade" value="7x / semana — alta intensidade" selected={responses.atividade === '7x / semana — alta intensidade'} onClick={() => selectSingle('atividade', '7x / semana — alta intensidade')} />
              </div>
            </div>

            <div className="mb-7">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Nível de estresse</p>
              <div className="flex flex-col gap-2">
                <Choice group="estresse" value="Normal" selected={responses.estresse === 'Normal'} onClick={() => selectSingle('estresse', 'Normal')} />
                <Choice group="estresse" value="Médio" selected={responses.estresse === 'Médio'} onClick={() => selectSingle('estresse', 'Médio')} />
                <Choice group="estresse" value="Alto" selected={responses.estresse === 'Alto'} onClick={() => selectSingle('estresse', 'Alto')} />
                <Choice group="estresse" value="Alto com sintomas físicos" selected={responses.estresse === 'Alto com sintomas físicos'} onClick={() => selectSingle('estresse', 'Alto com sintomas físicos')} />
              </div>
            </div>

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Tabagismo</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  <Choice group="tabaco" value="Não" selected={responses.tabaco === 'Não'} onClick={() => selectSingle('tabaco', 'Não')} />
                  <Choice group="tabaco" value="Sim" selected={responses.tabaco === 'Sim'} onClick={() => selectSingle('tabaco', 'Sim')} />
                </div>
                <span className="text-sm" style={{ color: 'var(--light-text)' }}>
                  Qtd. cigarros/dia: <input type="number" min="0" placeholder="—" className="anamnese-input ml-2" style={{ width: '70px' }} value={responses.tabaco_qtd || ''} onChange={e => setTextValue('tabaco_qtd', e.target.value)} />
                </span>
              </div>
            </div>
            {renderExtras('habitos')}
          </section>)}

          {/* ALERGIAS */}
          {secoesAtivas.includes('alergias') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Alergias
            </h2>

            {['Insetos', 'Picada de Abelha', 'Frutos do Mar', 'Cosméticos', 'Anestésicos', 'Outras Alergias'].map(item => (
              <div key={item} className="py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Alergia a <strong>{item}</strong></p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-2">
                    <Choice group={`alergia_${item}`} value="Não" selected={responses[`alergia_${item}`] === 'Não'} onClick={() => selectSingle(`alergia_${item}`, 'Não')} />
                    <Choice group={`alergia_${item}`} value="Sim" selected={responses[`alergia_${item}`] === 'Sim'} onClick={() => selectSingle(`alergia_${item}`, 'Sim')} />
                  </div>
                  <input type="text" className="anamnese-input flex-1" placeholder="Cite, se sim" style={{ minWidth: '150px' }} value={responses[`alergia_${item}_desc`] || ''} onChange={e => setTextValue(`alergia_${item}_desc`, e.target.value)} />
                </div>
              </div>
            ))}

            <div className="py-4">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Possui <strong>Herpes</strong></p>
              <div className="flex gap-2">
                <Choice group="herpes" value="Não" selected={responses.herpes === 'Não'} onClick={() => selectSingle('herpes', 'Não')} />
                <Choice group="herpes" value="Sim" selected={responses.herpes === 'Sim'} onClick={() => selectSingle('herpes', 'Sim')} />
              </div>
            </div>
            {renderExtras('alergias')}
          </section>)}

          {/* MEDICAMENTOS */}
          {secoesAtivas.includes('medicamentos') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Medicamentos em Uso
            </h2>

            {[
              { key: 'antiinfl', label: 'anti-inflamatório' },
              { key: 'antibio', label: 'antibiótico' },
              { key: 'cortic', label: 'corticóide' },
              { key: 'outroMed', label: 'outro medicamento' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-5">
                <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Está usando algum {label}?</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-2">
                    <Choice group={key} value="Não" selected={responses[key] === 'Não'} onClick={() => selectSingle(key, 'Não')} />
                    <Choice group={key} value="Sim" selected={responses[key] === 'Sim'} onClick={() => selectSingle(key, 'Sim')} />
                  </div>
                  <input type="text" className="anamnese-input flex-1" placeholder="Cite qual" style={{ minWidth: '150px' }} value={responses[`${key}_qual`] || ''} onChange={e => setTextValue(`${key}_qual`, e.target.value)} />
                </div>
              </div>
            ))}
            {renderExtras('medicamentos')}
          </section>)}

          {/* SAÚDE */}
          {secoesAtivas.includes('saude') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Saúde Geral
            </h2>

            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Possui alguma patologia (doença) auto-imune?</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  <Choice group="autoim" value="Não" selected={responses.autoim === 'Não'} onClick={() => selectSingle('autoim', 'Não')} />
                  <Choice group="autoim" value="Sim" selected={responses.autoim === 'Sim'} onClick={() => selectSingle('autoim', 'Sim')} />
                </div>
                <input type="text" className="anamnese-input flex-1" placeholder="Cite qual" style={{ minWidth: '150px' }} value={responses.autoim_qual || ''} onChange={e => setTextValue('autoim_qual', e.target.value)} />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Possui alguma outra patologia (doença)?</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  <Choice group="outrapat" value="Não" selected={responses.outrapat === 'Não'} onClick={() => selectSingle('outrapat', 'Não')} />
                  <Choice group="outrapat" value="Sim" selected={responses.outrapat === 'Sim'} onClick={() => selectSingle('outrapat', 'Sim')} />
                </div>
                <input type="text" className="anamnese-input flex-1" placeholder="Qual?" style={{ minWidth: '150px' }} value={responses.outrapat_qual || ''} onChange={e => setTextValue('outrapat_qual', e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Alguma informação relevante adicional?</p>
              <div className="flex gap-2 mb-3">
                <Choice group="inforelevante" value="Não" selected={responses.inforelevante === 'Não'} onClick={() => selectSingle('inforelevante', 'Não')} />
                <Choice group="inforelevante" value="Sim" selected={responses.inforelevante === 'Sim'} onClick={() => selectSingle('inforelevante', 'Sim')} />
              </div>
              <textarea className="anamnese-input" placeholder="Se sim, descreva aqui qual..." rows={3} value={responses.inforelevante_desc || ''} onChange={e => setTextValue('inforelevante_desc', e.target.value)} />
            </div>
            {renderExtras('saude')}
          </section>)}

          {/* OUTRAS INFORMAÇÕES */}
          {secoesAtivas.includes('outras') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Outras Informações
            </h2>

            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Autoriza uso da sua imagem?</p>
              <div className="flex gap-2">
                <Choice group="imagem" value="Sim" selected={responses.imagem === 'Sim'} onClick={() => selectSingle('imagem', 'Sim')} />
                <Choice group="imagem" value="Não" selected={responses.imagem === 'Não'} onClick={() => selectSingle('imagem', 'Não')} />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Aceita filmar sua experiência na clínica?</p>
              <div className="flex flex-col gap-2">
                <Choice group="filmado" value="Sim" selected={responses.filmado === 'Sim'} onClick={() => selectSingle('filmado', 'Sim')} />
                <Choice group="filmado" value="Sim, sem mostrar o rosto" selected={responses.filmado === 'Sim, sem mostrar o rosto'} onClick={() => selectSingle('filmado', 'Sim, sem mostrar o rosto')} />
                <Choice group="filmado" value="Não" selected={responses.filmado === 'Não'} onClick={() => selectSingle('filmado', 'Não')} />
              </div>
            </div>

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Onde você conheceu nossa clínica?</p>
              <div className="flex flex-col gap-2 mb-3">
                <Choice group="conheceu" value="Instagram" selected={responses.conheceu === 'Instagram'} onClick={() => selectSingle('conheceu', 'Instagram')} />
                <Choice group="conheceu" value="Indicação" selected={responses.conheceu === 'Indicação'} onClick={() => selectSingle('conheceu', 'Indicação')} />
                <Choice group="conheceu" value="Google" selected={responses.conheceu === 'Google'} onClick={() => selectSingle('conheceu', 'Google')} />
                <Choice group="conheceu" value="Outro" selected={responses.conheceu === 'Outro'} onClick={() => selectSingle('conheceu', 'Outro')} />
              </div>
              <input type="text" className="anamnese-input" placeholder="Se outro, especifique" value={responses.conheceu_outro || ''} onChange={e => setTextValue('conheceu_outro', e.target.value)} />
            </div>
            {renderExtras('outras')}
          </section>)}

          {/* EXCLUSIVO MULHERES */}
          {secoesAtivas.includes('mulheres') && (<><div className="text-center text-xs tracking-widest uppercase py-2 rounded-t" style={{ background: 'var(--gold)', color: 'var(--warm-white)' }}>
            Exclusivo para Mulheres
          </div>
          <section className="rounded-b p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)', borderTop: 'none' }}>
            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>No momento está grávida ou existe possibilidade de gravidez?</p>
              <div className="flex gap-2">
                <Choice group="gravida" value="Não" selected={responses.gravida === 'Não'} onClick={() => selectSingle('gravida', 'Não')} />
                <Choice group="gravida" value="Sim" selected={responses.gravida === 'Sim'} onClick={() => selectSingle('gravida', 'Sim')} />
              </div>
            </div>

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Está lactante (amamentando)?</p>
              <div className="flex gap-2">
                <Choice group="lactante" value="Não" selected={responses.lactante === 'Não'} onClick={() => selectSingle('lactante', 'Não')} />
                <Choice group="lactante" value="Sim" selected={responses.lactante === 'Sim'} onClick={() => selectSingle('lactante', 'Sim')} />
              </div>
            </div>
            {renderExtras('mulheres')}
          </section></>)}

          {/* PRINCIPAL QUEIXA */}
          {secoesAtivas.includes('queixa') && (<section className="rounded p-9 mb-7" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs tracking-widest uppercase pb-3 mb-7 border-b" style={{ color: 'var(--gold)', borderColor: 'var(--border)' }}>
              Principal Queixa
            </h2>

            <div className="mb-5">
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Selecione as áreas de interesse (múltiplas opções)</p>
              <div className="flex flex-col gap-2">
                {['Rugas / Botox', 'Contorno Facial / Ácido Hialurônico', 'Flacidez / Bioestimulador de Colágeno', 'Pele / Laser', 'Outro'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectMulti('queixa', opt)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm transition-all text-left"
                    style={{
                      border: `1px solid ${(responses.queixa || []).includes(opt) ? '#b89a6a' : '#e0d5c5'}`,
                      background: (responses.queixa || []).includes(opt) ? '#f5ede0' : '#f9f5f0',
                      color: (responses.queixa || []).includes(opt) ? '#1a1410' : '#8a7a6a',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center"
                      style={{ border: `1px solid ${(responses.queixa || []).includes(opt) ? '#b89a6a' : 'currentColor'}`, background: (responses.queixa || []).includes(opt) ? '#b89a6a' : 'transparent' }}
                    >
                      {(responses.queixa || []).includes(opt) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--mid)' }}>Observação</p>
              <textarea className="anamnese-input" placeholder="Descreva aqui todas as suas queixas facial ou corporal..." rows={4} value={responses.queixa_obs || ''} onChange={e => setTextValue('queixa_obs', e.target.value)} />
            </div>
            {renderExtras('queixa')}
          </section>)}

          {/* Submit */}
          <div className="text-center mt-10">
            <button
              onClick={() => setShowSignature(true)}
              className="px-14 py-4 rounded text-xs tracking-widest uppercase font-medium transition-all hover:shadow-lg"
              style={{ 
                background: 'var(--dark)', 
                color: 'var(--cream)',
              }}
            >
              Continuar para Assinar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}


