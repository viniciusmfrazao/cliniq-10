'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

const SECOES = [
  { id: 'procedimentos', label: 'Procedimentos Anteriores', desc: 'Botox, preenchedor, bioestimulador' },
  { id: 'habitos',       label: 'Hábitos de Vida',          desc: 'Atividade física, estresse, tabagismo' },
  { id: 'alergias',      label: 'Alergias',                 desc: 'Medicamentos, materiais, látex' },
  { id: 'medicamentos',  label: 'Medicamentos em Uso',      desc: 'Anticoagulantes, isotretinoína, etc.' },
  { id: 'saude',         label: 'Saúde Geral',              desc: 'Doenças, cirurgias, queloides' },
  { id: 'outras',        label: 'Outras Condições',         desc: 'Implantes, herpes, distúrbios' },
  { id: 'mulheres',      label: 'Exclusivo Mulheres',       desc: 'Gravidez, lactação' },
  { id: 'queixa',        label: 'Principal Queixa',         desc: 'Áreas de interesse e observações' },
]

type Pergunta = {
  id: string
  secao: string
  pergunta: string
  tipo: 'sim_nao' | 'texto' | 'multipla'
  opcoes?: string
}

type Config = {
  id: string
  titulo: string
  subtitulo: string
  cor_primaria: string
  secoes_ativas: string[]
  perguntas_extras: Pergunta[]
}

function gerarId() {
  return Math.random().toString(36).slice(2, 9)
}

export default function AnamneseConfigEditor({ config, clinicId }: { config: Config; clinicId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [titulo, setTitulo] = useState(config.titulo || 'Ficha de Anamnese Facial')
  const [subtitulo, setSubtitulo] = useState(config.subtitulo || '')
  const [cor, setCor] = useState(config.cor_primaria || '#b89a6a')
  const [secoesAtivas, setSecoesAtivas] = useState<string[]>(
    config.secoes_ativas || ['procedimentos','habitos','alergias','medicamentos','saude','outras','mulheres','queixa']
  )
  const [perguntas, setPerguntas] = useState<Pergunta[]>(
    (config.perguntas_extras || []).map((p: any) => ({ ...p, id: p.id || gerarId() }))
  )
  const [novaSecao, setNovaSecao] = useState('queixa')
  const [novaTipo, setNovaTipo] = useState<'sim_nao'|'texto'|'multipla'>('sim_nao')
  const [novaPergunta, setNovaPergunta] = useState('')
  const [novaOpcoes, setNovaOpcoes] = useState('')

  function toggleSecao(id: string) {
    setSecoesAtivas(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function adicionarPergunta() {
    if (!novaPergunta.trim()) return
    const p: Pergunta = {
      id: gerarId(),
      secao: novaSecao,
      pergunta: novaPergunta.trim(),
      tipo: novaTipo,
      opcoes: novaTipo === 'multipla' ? novaOpcoes : undefined,
    }
    setPerguntas(prev => [...prev, p])
    setNovaPergunta('')
    setNovaOpcoes('')
  }

  function removerPergunta(id: string) {
    setPerguntas(prev => prev.filter(p => p.id !== id))
  }

  function moverPergunta(id: string, dir: -1 | 1) {
    setPerguntas(prev => {
      const idx = prev.findIndex(p => p.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function editarPergunta(id: string, field: keyof Pergunta, value: string) {
    setPerguntas(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  async function salvar() {
    setSaving(true)
    try {
      const res = await fetch('/api/anamnese/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          subtitulo,
          cor_primaria: cor,
          secoes_ativas: secoesAtivas,
          perguntas_extras: perguntas,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      alert('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Identidade */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800">Identidade da Ficha</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo (opcional)</label>
          <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)}
            placeholder="Ex: Clínica de Estética Avançada"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cor de destaque</label>
          <div className="flex items-center gap-3">
            <input type="color" value={cor} onChange={e => setCor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            <span className="text-sm text-slate-500">{cor}</span>
          </div>
        </div>
      </div>

      {/* Seções */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">Seções da Ficha</h3>
          <p className="text-sm text-slate-500 mt-1">Ative ou desative seções completas da anamnese</p>
        </div>
        {SECOES.map(s => (
          <label key={s.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${
            secoesAtivas.includes(s.id)
              ? 'border-violet-200 bg-violet-50'
              : 'border-slate-100 bg-slate-50 opacity-60'
          }`}>
            <input
              type="checkbox"
              checked={secoesAtivas.includes(s.id)}
              onChange={() => toggleSecao(s.id)}
              className="w-4 h-4 accent-violet-600"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 text-sm">{s.label}</p>
              <p className="text-xs text-slate-500 truncate">{s.desc}</p>
            </div>
            {secoesAtivas.includes(s.id)
              ? <span className="text-xs text-violet-600 font-semibold">Ativa</span>
              : <span className="text-xs text-slate-400">Oculta</span>
            }
          </label>
        ))}
      </div>

      {/* Perguntas extras existentes */}
      {perguntas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <h3 className="font-bold text-slate-800">Perguntas Personalizadas</h3>
          {perguntas.map((p, idx) => (
            <div key={p.id} className="border border-slate-100 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    value={p.pergunta}
                    onChange={e => editarPergunta(p.id, 'pergunta', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => moverPergunta(p.id, -1)} disabled={idx === 0}
                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition">
                    <Icon name="chevronUp" className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => moverPergunta(p.id, 1)} disabled={idx === perguntas.length - 1}
                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition">
                    <Icon name="chevronDown" className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => removerPergunta(p.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-400 hover:text-red-600">
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs px-2 py-1 bg-slate-100 rounded-lg text-slate-600">
                  {SECOES.find(s => s.id === p.secao)?.label || p.secao}
                </span>
                <select value={p.tipo} onChange={e => editarPergunta(p.id, 'tipo', e.target.value)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600">
                  <option value="sim_nao">Sim / Não</option>
                  <option value="texto">Texto livre</option>
                  <option value="multipla">Múltipla escolha</option>
                </select>
                {p.tipo === 'multipla' && (
                  <input value={p.opcoes || ''} onChange={e => editarPergunta(p.id, 'opcoes', e.target.value)}
                    placeholder="Opção 1, Opção 2, Opção 3"
                    className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar nova pergunta */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Icon name="plus" className="w-5 h-5 text-violet-500" />
          Nova Pergunta Personalizada
        </h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pergunta</label>
          <input value={novaPergunta} onChange={e => setNovaPergunta(e.target.value)}
            placeholder="Ex: Já fez laserterapia? / Tem intolerância a algum produto?"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de resposta</label>
            <select value={novaTipo} onChange={e => setNovaTipo(e.target.value as any)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm">
              <option value="sim_nao">Sim / Não</option>
              <option value="texto">Texto livre</option>
              <option value="multipla">Múltipla escolha</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Seção</label>
            <select value={novaSecao} onChange={e => setNovaSecao(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm">
              {SECOES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {novaTipo === 'multipla' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opções (separadas por vírgula)</label>
            <input value={novaOpcoes} onChange={e => setNovaOpcoes(e.target.value)}
              placeholder="Ex: Nunca, Raramente, Às vezes, Sempre"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm" />
          </div>
        )}
        <button onClick={adicionarPergunta} disabled={!novaPergunta.trim()}
          className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50">
          Adicionar Pergunta
        </button>
      </div>

      {/* Salvar */}
      <div className="flex gap-3 pb-8">
        <button onClick={() => router.back()}
          className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition">
          Cancelar
        </button>
        <button onClick={salvar} disabled={saving}
          className={`flex-1 py-3 rounded-xl font-semibold text-white transition ${
            saved ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-700'
          } disabled:opacity-50`}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}
