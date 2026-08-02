'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

type Field = {
  id?: string
  secao: string
  label: string
  tipo: 'texto_curto' | 'texto_longo' | 'sim_nao' | 'single_select' | 'multi_select' | 'numero' | 'data'
  opcoes: string[] | null
  obrigatorio: boolean
  ativo: boolean
}

type Template = {
  id: string
  nome: string
  descricao: string | null
  cor_primaria: string
  campos_identificacao?: string[]
}

const TIPOS: { value: Field['tipo']; label: string }[] = [
  { value: 'texto_curto', label: 'Texto curto' },
  { value: 'texto_longo', label: 'Texto longo' },
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'single_select', label: 'Escolha única' },
  { value: 'multi_select', label: 'Múltipla escolha' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
]

const CAMPOS_ID = [
  { id: 'data_nascimento', label: 'Data de nascimento', desc: 'Paciente preenche se não cadastrado' },
  { id: 'cpf',             label: 'CPF',                 desc: 'Documento de identificação' },
  { id: 'telefone',        label: 'Telefone',             desc: 'Número de contato' },
  { id: 'email',           label: 'E-mail',               desc: 'Endereço de e-mail' },
]

function novoField(secao: string): Field {
  return { secao, label: '', tipo: 'texto_curto', opcoes: null, obrigatorio: false, ativo: true }
}

export default function TemplateBuilder({ template, initialFields }: { template: Template; initialFields: Field[] }) {
  const [nome, setNome] = useState(template.nome)
  const [descricao, setDescricao] = useState(template.descricao || '')
  const [camposId, setCamposId] = useState<string[]>(
    template.campos_identificacao?.length ? template.campos_identificacao : ['data_nascimento', 'cpf']
  )
  const [fields, setFields] = useState<Field[]>(initialFields.length > 0 ? initialFields : [])
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingFields, setSavingFields] = useState(false)
  const { error: toastError, success: toastSuccess } = useToast()

  const secoes = Array.from(new Set(fields.map(f => f.secao))).filter(Boolean)
  if (secoes.length === 0) secoes.push('Geral')

  function updateField(idx: number, patch: Partial<Field>) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  function removeField(idx: number) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function addField(secao: string) {
    setFields(prev => [...prev, novoField(secao)])
  }

  function toggleCampoId(id: string) {
    setCamposId(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function salvarInfo() {
    if (!nome.trim()) { toastError('Nome da ficha é obrigatório'); return }
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/anamnese/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), descricao, campos_identificacao: camposId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      toastSuccess('Nome atualizado')
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setSavingInfo(false)
    }
  }

  async function salvarCampos() {
    const semLabel = fields.some(f => !f.label.trim())
    if (semLabel) { toastError('Toda pergunta precisa de um texto'); return }
    setSavingFields(true)
    try {
      const res = await fetch(`/api/anamnese/templates/${template.id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar perguntas')
      setFields(data.fields)
      toastSuccess('Perguntas salvas')
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setSavingFields(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-3">
        <div>
          <label className="label">Nome da ficha</label>
          <input className="input" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">Descrição (opcional)</label>
          <input className="input" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: usada para procedimentos corporais" />
        </div>
        <div>
          <label className="label">Dados de identificação do paciente</label>
          <p className="text-xs text-slate-500 mb-2">
            Aparecem no cabeçalho da ficha. Se o paciente já tem o dado cadastrado, ele só confirma; senão, é obrigado a preencher.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS_ID.map(c => (
              <label key={c.id} className="flex items-start gap-2 p-2 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={camposId.includes(c.id)}
                  onChange={() => toggleCampoId(c.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <button className="btn btn-secondary" disabled={savingInfo} onClick={salvarInfo}>
          {savingInfo ? 'Salvando...' : 'Salvar nome'}
        </button>
      </div>

      {secoes.map(secao => (
        <div key={secao} className="card p-4 space-y-4">
          <h3 className="font-bold text-slate-900">{secao}</h3>
          {fields.map((f, idx) => f.secao !== secao ? null : (
            <div key={idx} className="p-3 border border-slate-100 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Texto da pergunta"
                  value={f.label}
                  onChange={e => updateField(idx, { label: e.target.value })}
                />
                <button onClick={() => moveField(idx, -1)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <Icon name="chevronUp" className="w-4 h-4 text-slate-400" />
                </button>
                <button onClick={() => moveField(idx, 1)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <Icon name="chevronDown" className="w-4 h-4 text-slate-400" />
                </button>
                <button onClick={() => removeField(idx)} className="p-2 hover:bg-red-50 rounded-lg">
                  <Icon name="trash" className="w-4 h-4 text-red-500" />
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="input w-auto"
                  value={f.tipo}
                  onChange={e => updateField(idx, {
                    tipo: e.target.value as Field['tipo'],
                    opcoes: ['single_select', 'multi_select'].includes(e.target.value) ? (f.opcoes || ['']) : null,
                  })}
                >
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={f.obrigatorio} onChange={e => updateField(idx, { obrigatorio: e.target.checked })} />
                  Obrigatória
                </label>
                <input
                  className="input w-40"
                  placeholder="Seção"
                  value={f.secao}
                  onChange={e => updateField(idx, { secao: e.target.value })}
                />
              </div>
              {['single_select', 'multi_select'].includes(f.tipo) && (
                <div className="space-y-1 pl-1">
                  {(f.opcoes || []).map((op, opIdx) => (
                    <div key={opIdx} className="flex items-center gap-2">
                      <input
                        className="input"
                        placeholder={`Opção ${opIdx + 1}`}
                        value={op}
                        onChange={e => {
                          const novasOpcoes = [...(f.opcoes || [])]
                          novasOpcoes[opIdx] = e.target.value
                          updateField(idx, { opcoes: novasOpcoes })
                        }}
                      />
                      <button
                        onClick={() => updateField(idx, { opcoes: (f.opcoes || []).filter((_, i) => i !== opIdx) })}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Icon name="x" className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateField(idx, { opcoes: [...(f.opcoes || []), ''] })}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    + Adicionar opção
                  </button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => addField(secao)} className="btn btn-secondary flex items-center gap-2 w-fit">
            <Icon name="plus" className="w-4 h-4" />
            Nova pergunta em {secao}
          </button>
        </div>
      ))}

      <button
        onClick={() => addField(`Nova seção ${secoes.length + 1}`)}
        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        + Adicionar nova seção
      </button>

      <div className="sticky bottom-4">
        <button className="btn-primary w-full" disabled={savingFields} onClick={salvarCampos}>
          {savingFields ? 'Salvando...' : 'Salvar perguntas'}
        </button>
      </div>
    </div>
  )
}
