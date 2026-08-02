'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useAnamneseTemplatePicker, resolveAutoTemplateId, type TemplateOption } from '@/lib/useAnamneseTemplatePicker'

export default function AnamnesePresencialButton({ patientId }: { patientId: string }) {
  const { loadOptions } = useAnamneseTemplatePicker()
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [padraoAtiva, setPadraoAtiva] = useState(true)
  const [opcoes, setOpcoes] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  async function abrirFicha(templateId: string | null) {
    setLoading(true)
    try {
      const res = await fetch('/api/anamnese/presencial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, templateId: templateId || undefined }),
      })
      const data = await res.json()
      if (data.ok && data.link) {
        window.open(data.link, '_blank', 'noopener,noreferrer')
      } else {
        alert('Erro ao abrir ficha: ' + (data.error || 'tente novamente'))
      }
    } catch {
      alert('Erro ao abrir ficha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleClick() {
    if (loading || picking) return
    setLoading(true)
    const options = await loadOptions()
    setLoading(false)
    setPadraoAtiva(options.padraoAtiva)
    setOpcoes(options.templates)

    const resolved = resolveAutoTemplateId(options)
    if (resolved.auto) {
      void abrirFicha(resolved.templateId)
      return
    }

    setSelectedTemplateId(options.padraoAtiva ? '' : options.templates[0].id)
    setPicking(true)
  }

  if (picking) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          className="input text-xs py-1.5"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          {padraoAtiva && <option value="">Ficha padrão</option>}
          {opcoes.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setPicking(false); void abrirFicha(selectedTemplateId || null) }}
          className="btn-primary px-3 py-1.5 text-xs"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
    >
      <Icon name="tablet" className="w-4 h-4" />
      {loading ? 'Abrindo...' : 'Preencher aqui'}
    </button>
  )
}
