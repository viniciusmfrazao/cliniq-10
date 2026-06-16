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

type SubPergunta = {
  pergunta: string
  tipo: 'texto' | 'numero'
  placeholder?: string
  condicao_valor: string // mostra quando resposta principal === este valor
}

type Pergunta = {
  id: string
  secao: string
  pergunta: string
  tipo: 'sim_nao' | 'texto' | 'multipla'
  opcoes?: string
  sub_pergunta?: SubPergunta
}

type Config = {
  id: string
  titulo: string
  subtitulo: string
  cor_primaria: string
  secoes_ativas: string[]
  perguntas_extras: Pergunta[]
  campos_identificacao: string[]
}

const CAMPOS_ID = [
  { id: 'data_nascimento', label: 'Data de nascimento', desc: 'Paciente preenche se não cadastrado' },
  { id: 'cpf',            label: 'CPF',                 desc: 'Documento de identificação' },
  { id: 'telefone',       label: 'Telefone',             desc: 'Número de contato' },
  { id: 'email',          label: 'E-mail',               desc: 'Endereço de e-mail' },
]

function gerarId() {
  return Math.random().toString(36).slice(2, 9)
}

function PerguntaCard({
  p,
  idx,
  total,
  onMover,
  onRemover,
  onEditar,
}: {
  p: Pergunta
  idx: number
  total: number
  onMover: (id: string, dir: -1 | 1) => void
  onRemover: (id: string) => void
  onEditar: (id: string, field: string, value: unknown) => void
}) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header da pergunta */}
      <div className="flex items-center gap-2 p-3 bg-slate-50">
        {/* Botões de ordem */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={() => onMover(p.id, -1)}
            disabled={idx === 0}
            className="p-1 hover:bg-slate-200 rounded disabled:opacity-20 transition"
          >
            <Icon name="chevronUp" className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button
            onClick={() => onMover(p.id, 1)}
            disabled={idx === total - 1}
            className="p-1 hover:bg-slate-200 rounded disabled:opacity-20 transition"
          >
            <Icon name="chevronDown" className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Número */}
        <span className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
          {idx + 1}
        </span>

        {/* Texto da pergunta */}
        <input
          value={p.pergunta}
          onChange={e => onEditar(p.id, 'pergunta', e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        />

        {/* Expandir / remover */}
        <button
          onClick={() => setExpandido(v => !v)}
          className="p-1.5 hover:bg-slate-200 rounded-lg transition flex-shrink-0"
          title="Configurar"
        >
          <Icon name={expandido ? 'chevronUp' : 'settings'} className="w-4 h-4 text-slate-500" />
        </button>
        <button
          onClick={() => onRemover(p.id)}
          className="p-1.5 hover:bg-red-50 rounded-lg transition flex-shrink-0 text-red-400 hover:text-red-600"
        >
          <Icon name="trash" className="w-4 h-4" />
        </button>
      </div>

      {/* Painel expandido */}
      {expandido && (
        <div className="p-4 border-t border-slate-100 space-y-4 bg-white">
          {/* Tipo e seção */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de resposta</label>
              <select
                value={p.tipo}
                onChange={e => onEditar(p.id, 'tipo', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              >
                <option value="sim_nao">Sim / Não</option>
                <option value="texto">Texto livre</option>
                <option value="multipla">Múltipla escolha</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Seção</label>
              <select
                value={p.secao}
                onChange={e => onEditar(p.id, 'secao', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              >
                {SECOES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Opções de múltipla escolha */}
          {p.tipo === 'multipla' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Opções (separadas por vírgula)</label>
              <input
                value={p.opcoes || ''}
                onChange={e => onEditar(p.id, 'opcoes', e.target.value)}
                placeholder="Ex: Nunca, Raramente, Às vezes, Sempre"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          )}

          {/* Sub-pergunta condicional */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-800">↳ Sub-pergunta condicional</p>
              {p.sub_pergunta ? (
                <button
                  onClick={() => onEditar(p.id, 'sub_pergunta', undefined)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remover
                </button>
              ) : (
                <button
                  onClick={() => onEditar(p.id, 'sub_pergunta', {
                    pergunta: '',
                    tipo: 'texto',
                    placeholder: '',
                    condicao_valor: p.tipo === 'sim_nao' ? 'Sim' : '',
                  } as SubPergunta)}
                  className="text-xs text-amber-700 font-semibold hover:text-amber-900"
                >
                  + Adicionar
                </button>
              )}
            </div>

            {p.sub_pergunta && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700">Aparece quando resposta for:</span>
                  {p.tipo === 'sim_nao' ? (
                    <select
                      value={p.sub_pergunta.condicao_valor}
                      onChange={e => onEditar(p.id, 'sub_pergunta', { ...p.sub_pergunta!, condicao_valor: e.target.value })}
                      className="text-xs px-2 py-1 border border-amber-300 rounded-lg bg-white"
                    >
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  ) : (
                    <input
                      value={p.sub_pergunta.condicao_valor}
                      onChange={e => onEditar(p.id, 'sub_pergunta', { ...p.sub_pergunta!, condicao_valor: e.target.value })}
                      placeholder="valor que dispara"
                      className="text-xs px-2 py-1 border border-amber-300 rounded-lg bg-white flex-1"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-800 mb-1">Pergunta de follow-up</label>
                  <input
                    value={p.sub_pergunta.pergunta}
                    onChange={e => onEditar(p.id, 'sub_pergunta', { ...p.sub_pergunta!, pergunta: e.target.value })}
                    placeholder="Ex: Quantos cigarros por dia?"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">Tipo da sub-resposta</label>
                    <select
                      value={p.sub_pergunta.tipo}
                      onChange={e => onEditar(p.id, 'sub_pergunta', { ...p.sub_pergunta!, tipo: e.target.value as 'texto' | 'numero' })}
                      className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                    >
                      <option value="texto">Texto livre</option>
                      <option value="numero">Número</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">Placeholder</label>
                    <input
                      value={p.sub_pergunta.placeholder || ''}
                      onChange={e => onEditar(p.id, 'sub_pergunta', { ...p.sub_pergunta!, placeholder: e.target.value })}
                      placeholder="Ex: 0–20 cigarros"
                      className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnamneseConfigForm({ config, clinicId }: { config: Config; clinicId: string }) {
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
    (config.perguntas_extras || []).map((p: Pergunta) => ({ ...p, id: p.id || gerarId() }))
  )
  const [camposId, setCamposId] = useState<string[]>(
    config.campos_identificacao || []
  )
  const [novaSecao, setNovaSecao] = useState('queixa')
  const [modalTeste, setModalTeste] = useState(false)
  const [telefoneTeste, setTelefoneTeste] = useState('')
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState<{ link?: string; sent?: boolean; error?: string } | null>(null)

  async function enviarTeste() {
    if (!telefoneTeste.trim()) return
    setEnviandoTeste(true)
    setResultadoTeste(null)
    try {
      const res = await fetch('/api/anamnese/teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneTeste }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultadoTeste({ error: data.error || 'Erro ao enviar' })
      } else {
        setResultadoTeste({ link: data.link, sent: data.sent })
      }
    } catch {
      setResultadoTeste({ error: 'Erro de conexão' })
    } finally {
      setEnviandoTeste(false)
    }
  }
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

  function editarPergunta(id: string, field: string, value: unknown) {
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
          campos_identificacao: camposId,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        window.location.reload()
      }, 800)
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

      {/* Campos de identificação */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">Dados do Paciente</h3>
          <p className="text-sm text-slate-500 mt-1">Campos que o paciente preenche na ficha caso não estejam cadastrados</p>
        </div>
        {CAMPOS_ID.map(c => (
          <label key={c.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${
            camposId.includes(c.id)
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-slate-100 bg-slate-50 opacity-60'
          }`}>
            <input
              type="checkbox"
              checked={camposId.includes(c.id)}
              onChange={() => setCamposId(prev =>
                prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
              )}
              className="w-4 h-4 accent-emerald-600"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 text-sm">{c.label}</p>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
            {camposId.includes(c.id)
              ? <span className="text-xs text-emerald-600 font-semibold">Ativo</span>
              : <span className="text-xs text-slate-400">Inativo</span>
            }
          </label>
        ))}
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

      {/* Perguntas personalizadas */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">Perguntas Personalizadas</h3>
          <p className="text-sm text-slate-500 mt-1">
            {perguntas.length === 0
              ? 'Nenhuma pergunta adicionada ainda'
              : `${perguntas.length} pergunta${perguntas.length > 1 ? 's' : ''} — arraste ↑↓ para reordenar`}
          </p>
        </div>

        {perguntas.map((p, idx) => (
          <PerguntaCard
            key={p.id}
            p={p}
            idx={idx}
            total={perguntas.length}
            onMover={moverPergunta}
            onRemover={removerPergunta}
            onEditar={editarPergunta}
          />
        ))}
      </div>

      {/* Adicionar nova pergunta */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Icon name="plus" className="w-5 h-5 text-violet-500" />
          Nova Pergunta
        </h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pergunta</label>
          <input
            value={novaPergunta}
            onChange={e => setNovaPergunta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionarPergunta()}
            placeholder="Ex: Fuma? / Já fez laserterapia? / Usa protetor solar?"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de resposta</label>
            <select value={novaTipo} onChange={e => setNovaTipo(e.target.value as 'sim_nao'|'texto'|'multipla')}
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
          + Adicionar Pergunta
        </button>
      </div>

      {/* Botões */}
      <div className="space-y-3 pb-8">
        {/* Enviar teste */}
        <button
          onClick={() => { setModalTeste(true); setResultadoTeste(null) }}
          className="w-full py-3 border-2 border-dashed border-violet-300 rounded-xl font-semibold text-violet-600 hover:bg-violet-50 transition flex items-center justify-center gap-2"
        >
          <Icon name="send" className="w-4 h-4" />
          Enviar ficha de teste
        </button>

        <div className="flex gap-3">
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

      {/* Modal de teste */}
      {modalTeste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Enviar ficha de teste</h3>
              <button onClick={() => { setModalTeste(false); setResultadoTeste(null); setTelefoneTeste('') }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-400">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {!resultadoTeste ? (
              <>
                <p className="text-sm text-slate-500">
                  Digite o número que vai receber a ficha de teste via WhatsApp.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número (com DDD)</label>
                  <input
                    type="tel"
                    value={telefoneTeste}
                    onChange={e => setTelefoneTeste(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && enviarTeste()}
                    placeholder="Ex: 34991805722"
                    autoFocus
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm"
                  />
                </div>
                <button
                  onClick={enviarTeste}
                  disabled={enviandoTeste || !telefoneTeste.trim()}
                  className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50"
                >
                  {enviandoTeste ? 'Enviando...' : 'Enviar via WhatsApp'}
                </button>
              </>
            ) : resultadoTeste.error ? (
              <>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  ❌ {resultadoTeste.error}
                </div>
                <button onClick={() => setResultadoTeste(null)}
                  className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Tentar novamente
                </button>
              </>
            ) : (
              <>
                {resultadoTeste.sent ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
                    ✅ Enviado com sucesso! Verifique o WhatsApp do número informado.
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 space-y-2">
                    <p>⚠️ WhatsApp não disponível. Copie o link abaixo para testar:</p>
                    <a href={resultadoTeste.link} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-violet-600 underline break-all">
                      {resultadoTeste.link}
                    </a>
                  </div>
                )}
                <button onClick={() => { setModalTeste(false); setResultadoTeste(null); setTelefoneTeste('') }}
                  className="w-full py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-200 transition">
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
