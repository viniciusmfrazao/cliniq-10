'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SECOES = [
  { key: 'procedimentos', label: 'Procedimentos Anteriores' },
  { key: 'habitos', label: 'Hábitos de Vida' },
  { key: 'alergias', label: 'Alergias' },
  { key: 'medicamentos', label: 'Medicamentos em Uso' },
  { key: 'saude', label: 'Saúde Geral' },
  { key: 'outras', label: 'Outras Informações' },
  { key: 'mulheres', label: 'Exclusivo para Mulheres' },
  { key: 'queixa', label: 'Principal Queixa' },
]

const CORES_PRESET = [
  { label: 'Dourado', value: '#b89a6a' },
  { label: 'Rosa', value: '#e8a4b8' },
  { label: 'Roxo', value: '#7C3AED' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Preto', value: '#1a1410' },
]

type PerguntaExtra = {
  secao: string
  pergunta: string
  tipo: 'sim_nao' | 'texto' | 'multipla'
  opcoes?: string
}

type Config = {
  titulo: string
  subtitulo: string
  cor_primaria: string
  secoes_ativas: string[]
  perguntas_extras: PerguntaExtra[]
}

type Props = {
  clinicId: string
  initialConfig: any
}

export default function AnamneseConfigForm({ clinicId, initialConfig }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [config, setConfig] = useState<Config>({
    titulo: initialConfig?.titulo || 'Ficha de Anamnese Facial',
    subtitulo: initialConfig?.subtitulo || '',
    cor_primaria: initialConfig?.cor_primaria || '#b89a6a',
    secoes_ativas: initialConfig?.secoes_ativas || SECOES.map(s => s.key),
    perguntas_extras: initialConfig?.perguntas_extras || [],
  })

  const [novaPergunta, setNovaPergunta] = useState<PerguntaExtra>({
    secao: 'queixa',
    pergunta: '',
    tipo: 'sim_nao',
    opcoes: '',
  })

  function toggleSecao(key: string) {
    setConfig(prev => ({
      ...prev,
      secoes_ativas: prev.secoes_ativas.includes(key)
        ? prev.secoes_ativas.filter(s => s !== key)
        : [...prev.secoes_ativas, key],
    }))
  }

  function adicionarPergunta() {
    if (!novaPergunta.pergunta.trim()) return
    setConfig(prev => ({
      ...prev,
      perguntas_extras: [...prev.perguntas_extras, { ...novaPergunta }],
    }))
    setNovaPergunta({ secao: 'queixa', pergunta: '', tipo: 'sim_nao', opcoes: '' })
  }

  function removerPergunta(idx: number) {
    setConfig(prev => ({
      ...prev,
      perguntas_extras: prev.perguntas_extras.filter((_, i) => i !== idx),
    }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('anamnese_config').upsert({
      clinic_id: clinicId,
      ...config,
    }, { onConflict: 'clinic_id' })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-8">

      {/* Título e subtítulo */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Título da Ficha</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título principal</label>
            <input
              type="text"
              value={config.titulo}
              onChange={e => setConfig(prev => ({ ...prev, titulo: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder="ex: Ficha de Anamnese Facial"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subtítulo <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              value={config.subtitulo}
              onChange={e => setConfig(prev => ({ ...prev, subtitulo: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder="ex: Harmonização Facial"
            />
          </div>
        </div>
      </div>

      {/* Cor */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Cor Principal</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {CORES_PRESET.map(cor => (
            <button
              key={cor.value}
              onClick={() => setConfig(prev => ({ ...prev, cor_primaria: cor.value }))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                config.cor_primaria === cor.value
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-black/10" style={{ background: cor.value }} />
              {cor.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 dark:text-slate-400">Cor personalizada:</label>
          <input
            type="color"
            value={config.cor_primaria}
            onChange={e => setConfig(prev => ({ ...prev, cor_primaria: e.target.value }))}
            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200"
          />
          <span className="text-sm font-mono text-slate-500">{config.cor_primaria}</span>
        </div>

        {/* Preview */}
        <div className="mt-4 p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs text-slate-500 mb-2">Preview:</p>
          <div className="text-xs tracking-widest uppercase" style={{ color: config.cor_primaria }}>
            {config.titulo || 'Nome da Clínica'}
          </div>
          <div className="w-16 h-px mt-2" style={{ background: config.cor_primaria, opacity: 0.5 }} />
        </div>
      </div>

      {/* Seções */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-1">Seções da Ficha</h2>
        <p className="text-sm text-slate-500 mb-4">Escolha quais seções aparecem na ficha do paciente.</p>
        <div className="space-y-2">
          {SECOES.map(secao => (
            <label key={secao.key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.secoes_ativas.includes(secao.key)}
                onChange={() => toggleSecao(secao.key)}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{secao.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Perguntas extras */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-1">Perguntas Extras</h2>
        <p className="text-sm text-slate-500 mb-4">Adicione perguntas personalizadas em qualquer seção.</p>

        {/* Lista de perguntas */}
        {config.perguntas_extras.length > 0 && (
          <div className="space-y-2 mb-6">
            {config.perguntas_extras.map((p, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.pergunta}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {SECOES.find(s => s.key === p.secao)?.label} · {p.tipo === 'sim_nao' ? 'Sim/Não' : p.tipo === 'texto' ? 'Texto livre' : 'Múltipla escolha'}
                    {p.tipo === 'multipla' && p.opcoes && ` (${p.opcoes})`}
                  </p>
                </div>
                <button onClick={() => removerPergunta(idx)} className="text-red-500 hover:text-red-700 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar nova pergunta */}
        <div className="border border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nova pergunta</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Seção</label>
              <select
                value={novaPergunta.secao}
                onChange={e => setNovaPergunta(prev => ({ ...prev, secao: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {SECOES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo de resposta</label>
              <select
                value={novaPergunta.tipo}
                onChange={e => setNovaPergunta(prev => ({ ...prev, tipo: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="sim_nao">Sim / Não</option>
                <option value="texto">Texto livre</option>
                <option value="multipla">Múltipla escolha</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Pergunta</label>
            <input
              type="text"
              value={novaPergunta.pergunta}
              onChange={e => setNovaPergunta(prev => ({ ...prev, pergunta: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="ex: Faz uso de anticoagulante?"
            />
          </div>
          {novaPergunta.tipo === 'multipla' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Opções (separadas por vírgula)</label>
              <input
                type="text"
                value={novaPergunta.opcoes}
                onChange={e => setNovaPergunta(prev => ({ ...prev, opcoes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                placeholder="ex: Sempre, Às vezes, Nunca"
              />
            </div>
          )}
          <button
            onClick={adicionarPergunta}
            disabled={!novaPergunta.pergunta.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            + Adicionar pergunta
          </button>
        </div>
      </div>

      {/* Salvar */}
      <div className="flex justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Salvo com sucesso!
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
