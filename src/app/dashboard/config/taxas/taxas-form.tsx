'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Taxa = {
  id: string
  forma: string
  bandeira: string
  taxa_percentual: number
  dias_repasse: number | null
  modo_repasse: 'fixo' | 'parcelado' | null
}

type Config = { taxa: number; dias: number; modo: 'fixo' | 'parcelado' }

const FORMAS = [
  { key: 'pix', label: 'Pix', parcelavel: false },
  { key: 'dinheiro', label: 'Dinheiro', parcelavel: false },
  { key: 'boleto', label: 'Boleto', parcelavel: false },
  { key: 'debito', label: 'Débito', parcelavel: false },
  { key: 'credito_1x', label: 'Crédito 1x', parcelavel: true, n: 1 },
  { key: 'credito_2x', label: 'Crédito 2x', parcelavel: true, n: 2 },
  { key: 'credito_3x', label: 'Crédito 3x', parcelavel: true, n: 3 },
  { key: 'credito_4x', label: 'Crédito 4x', parcelavel: true, n: 4 },
  { key: 'credito_5x', label: 'Crédito 5x', parcelavel: true, n: 5 },
  { key: 'credito_6x', label: 'Crédito 6x', parcelavel: true, n: 6 },
  { key: 'credito_7x', label: 'Crédito 7x', parcelavel: true, n: 7 },
  { key: 'credito_8x', label: 'Crédito 8x', parcelavel: true, n: 8 },
  { key: 'credito_9x', label: 'Crédito 9x', parcelavel: true, n: 9 },
  { key: 'credito_10x', label: 'Crédito 10x', parcelavel: true, n: 10 },
  { key: 'credito_11x', label: 'Crédito 11x', parcelavel: true, n: 11 },
  { key: 'credito_12x', label: 'Crédito 12x', parcelavel: true, n: 12 },
]

const BANDEIRAS = [
  { key: 'todas', label: 'Padrão (todas as bandeiras)' },
  { key: 'visa', label: 'Visa' },
  { key: 'master', label: 'Mastercard' },
  { key: 'elo', label: 'Elo' },
  { key: 'amex', label: 'American Express' },
  { key: 'hipercard', label: 'Hipercard' },
]

const DIAS_PRESETS = [
  { dias: 0, label: 'Hoje' },
  { dias: 1, label: 'Amanhã' },
  { dias: 2, label: '2 dias' },
  { dias: 3, label: '3 dias' },
  { dias: 4, label: '4 dias' },
  { dias: 5, label: '5 dias' },
  { dias: 6, label: '6 dias' },
  { dias: 7, label: '7 dias' },
  { dias: 14, label: '14 dias' },
  { dias: 21, label: '21 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 31, label: '31 dias' },
  { dias: 60, label: '60 dias' },
  { dias: 90, label: '90 dias' },
]

function defaultConfig(forma: string): Config {
  if (forma === 'pix' || forma === 'dinheiro' || forma === 'boleto') return { taxa: 0, dias: 0, modo: 'fixo' }
  if (forma === 'debito') return { taxa: 0, dias: 1, modo: 'fixo' }
  return { taxa: 0, dias: 30, modo: 'parcelado' } // crédito
}

function prazoResumo(c: Config, n: number): string {
  if (c.dias === 0 && c.modo === 'fixo') return 'Recebe na hora'
  if (c.modo === 'parcelado' && n > 1) {
    const ultima = 30 + (n - 1) * 30
    return `Parcelado: 1ª em 30 dias, última em ${ultima} dias`
  }
  return `Recebe em ${c.dias} dia${c.dias > 1 ? 's' : ''} (valor cheio)`
}

export default function TaxasForm({ clinicId, initialTaxas }: { clinicId: string; initialTaxas: Taxa[] }) {
  const supabase = createClient()

  const [configs, setConfigs] = useState<Record<string, Config>>(
    Object.fromEntries(initialTaxas.map(t => [
      `${t.forma}__${t.bandeira}`,
      { taxa: t.taxa_percentual, dias: t.dias_repasse ?? defaultConfig(t.forma).dias, modo: t.modo_repasse ?? defaultConfig(t.forma).modo },
    ]))
  )
  const [bandeira, setBandeira] = useState('todas')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Modal
  const [modalForma, setModalForma] = useState<string | null>(null)
  const [draft, setDraft] = useState<Config>({ taxa: 0, dias: 30, modo: 'parcelado' })

  function getConfig(formaKey: string): Config {
    const proprio = configs[`${formaKey}__${bandeira}`]
    if (proprio) return proprio
    if (bandeira !== 'todas') {
      const padrao = configs[`${formaKey}__todas`]
      if (padrao) return padrao
    }
    return defaultConfig(formaKey)
  }

  function openModal(formaKey: string) {
    setModalForma(formaKey)
    setDraft(getConfig(formaKey))
  }

  async function persist(formaKey: string, cfg: Config) {
    setSavingKey(formaKey)
    const { error } = await supabase
      .from('taxas_pagamento')
      .upsert({
        clinic_id: clinicId,
        forma: formaKey,
        bandeira,
        taxa_percentual: cfg.taxa,
        dias_repasse: cfg.dias,
        modo_repasse: cfg.modo,
      }, { onConflict: 'clinic_id,forma,bandeira' })

    setSavingKey(null)
    if (error) { alert('Erro ao salvar: ' + error.message); return false }
    setConfigs(p => ({ ...p, [`${formaKey}__${bandeira}`]: cfg }))
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
    return true
  }

  async function handleSalvar() {
    if (!modalForma) return
    const ok = await persist(modalForma, draft)
    if (ok) setModalForma(null)
  }

  async function handleSalvarProxima() {
    if (!modalForma) return
    const atual = FORMAS.find(f => f.key === modalForma)
    if (!atual?.parcelavel) { handleSalvar(); return }
    const ok = await persist(modalForma, draft)
    if (!ok) return
    const proximo = FORMAS.find(f => f.parcelavel && (f as any).n === (atual as any).n + 1)
    if (!proximo) { setModalForma(null); return }
    // Mantém taxa/dias/modo como sugestão de partida pra próxima parcela
    setModalForma(proximo.key)
    setDraft(getConfig(proximo.key).taxa > 0 || getConfig(proximo.key).dias !== defaultConfig(proximo.key).dias
      ? getConfig(proximo.key)
      : draft)
  }

  const modalFormaObj = FORMAS.find(f => f.key === modalForma)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 A taxa calcula o valor líquido nas entradas financeiras. O prazo alimenta o Recebíveis Futuros
        (quando o dinheiro cai no caixa). Clique em uma forma de pagamento pra configurar.
      </div>

      {/* Seletor de bandeira */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Bandeira</label>
        <div className="flex flex-wrap gap-2">
          {BANDEIRAS.map(b => (
            <button key={b.key} onClick={() => setBandeira(b.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                bandeira === b.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de formas — cada linha abre o modal de configuração */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div>Forma de pagamento</div>
          <div>Taxa</div>
          <div className="hidden sm:block">Prazo</div>
          <div />
        </div>
        {FORMAS.map((forma, i) => {
          const proprio = configs[`${forma.key}__${bandeira}`]
          const padrao = configs[`${forma.key}__todas`]
          const usandoPadrao = bandeira !== 'todas' && !proprio && !!padrao
          const efetivo = proprio || (bandeira !== 'todas' ? padrao : undefined)
          const configurado = !!efetivo
          // Só faz sentido avisar de "exceção" quando estou olhando o Padrão e
          // outra bandeira específica sobrescreve — pra não passar batido.
          const excecoes = bandeira === 'todas'
            ? BANDEIRAS.filter(b => b.key !== 'todas' && configs[`${forma.key}__${b.key}`])
            : []
          return (
            <button key={forma.key} onClick={() => openModal(forma.key)}
              className={`w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                i < FORMAS.length - 1 ? 'border-b border-slate-100' : ''
              }`}>
              <div>
                <div className="text-sm font-medium text-slate-800">{forma.label}</div>
                {excecoes.length > 0 && (
                  <div className="text-[11px] text-amber-600 mt-0.5">
                    ⚠ taxa própria em: {excecoes.map(e => e.label.replace('Padrão (todas as bandeiras)', '')).join(', ')}
                  </div>
                )}
                {usandoPadrao && (
                  <div className="text-[11px] text-slate-400 mt-0.5">sem taxa própria — usando o Padrão</div>
                )}
              </div>
              <div className={`text-sm ${configurado ? (usandoPadrao ? 'text-slate-500' : 'text-slate-900 font-semibold') : 'text-slate-300'}`}>
                {configurado ? `${efetivo!.taxa}%` : '—'}
              </div>
              <div className={`hidden sm:block text-xs ${configurado ? 'text-slate-500' : 'text-slate-300'}`}>
                {configurado ? prazoResumo(efetivo!, (forma as any).n || 1) : 'Não configurado'}
              </div>
              <Icon name="edit" className="w-4 h-4 text-slate-300 justify-self-end" />
            </button>
          )
        })}
      </div>

      {savedFlash && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
          <Icon name="check" className="w-4 h-4" /> Salvo!
        </div>
      )}

      {/* Modal de configuração */}
      {modalForma && modalFormaObj && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalForma(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Configurar Taxa</h3>
              <button onClick={() => setModalForma(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <Icon name="x" className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-center text-sm font-semibold text-violet-600">
                Configurando: {BANDEIRAS.find(b => b.key === bandeira)?.label}
              </p>

              {bandeira === 'todas' ? (() => {
                const excecoes = BANDEIRAS.filter(b => b.key !== 'todas' && configs[`${modalForma}__${b.key}`])
                return excecoes.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    ⚠ {excecoes.map(e => e.label).join(', ')} {excecoes.length > 1 ? 'têm' : 'tem'} taxa própria pra {modalFormaObj.label} e não vão mudar com o Padrão — elas sempre têm prioridade sobre ele.
                  </div>
                ) : null
              })() : (() => {
                const temPropria = !!configs[`${modalForma}__${bandeira}`]
                const padrao = configs[`${modalForma}__todas`]
                if (temPropria) {
                  return (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800">
                      Essa é uma taxa própria pra {BANDEIRAS.find(b => b.key === bandeira)?.label} — ela tem prioridade sobre o Padrão pra essa forma de pagamento.
                    </div>
                  )
                }
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    Ainda sem taxa própria — hoje {modalFormaObj.label} nessa bandeira usa o Padrão{padrao ? ` (${padrao.taxa}%)` : ' (não configurado)'}.
                    Salvando aqui, essa bandeira passa a ter prioridade sobre o Padrão só pra essa forma.
                  </div>
                )
              })()}


              {modalFormaObj.parcelavel ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Número de Parcelas</label>
                  <select
                    value={modalForma}
                    onChange={e => openModal(e.target.value)}
                    className="input w-full"
                  >
                    {FORMAS.filter(f => f.parcelavel).map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Forma de pagamento</p>
                  <p className="text-sm text-slate-500">{modalFormaObj.label}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  Você recebe em:
                  <span title="Dias corridos até o valor entrar no seu financeiro.">
                    <Icon name="info" className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {modalFormaObj.parcelavel && (modalFormaObj as any).n > 1 && (
                    <button
                      onClick={() => setDraft(d => ({ ...d, modo: 'parcelado', dias: 30 }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        draft.modo === 'parcelado'
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-white border-violet-300 text-violet-600 hover:bg-violet-50'
                      }`}>
                      CONFORME PARCELAS
                    </button>
                  )}
                  {DIAS_PRESETS.map(p => (
                    <button key={p.dias}
                      onClick={() => setDraft(d => ({ ...d, modo: 'fixo', dias: p.dias }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        draft.modo === 'fixo' && draft.dias === p.dias
                          ? 'bg-slate-800 border-slate-800 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {p.label.toUpperCase()}
                    </button>
                  ))}
                </div>

                {draft.modo === 'parcelado' && modalFormaObj.parcelavel && (
                  <p className="text-sm text-blue-600 mt-3">
                    Com esta opção, a primeira parcela cairá no financeiro em 30 dias, a segunda em 60 dias e assim por diante
                    {(modalFormaObj as any).n > 2 ? `, até a ${(modalFormaObj as any).n}ª em ${30 * (modalFormaObj as any).n} dias.` : '.'}
                  </p>
                )}
                {draft.modo === 'fixo' && (
                  <p className="text-sm text-slate-500 mt-3">
                    {draft.dias === 0
                      ? 'O valor cheio cai no financeiro no mesmo dia da venda.'
                      : `O valor cheio cai no financeiro ${draft.dias} dia${draft.dias > 1 ? 's' : ''} após a venda, de uma vez.`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Taxa (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} step={0.01}
                    value={draft.taxa}
                    onChange={e => setDraft(d => ({ ...d, taxa: parseFloat(e.target.value) || 0 }))}
                    className="input w-28 text-center"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  {draft.taxa > 0 && (
                    <span className="text-xs text-slate-400">= R$ {draft.taxa.toFixed(2)} em R$ 100,00</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModalForma(null)}
                className="px-5 py-2.5 border border-violet-300 text-violet-600 rounded-xl font-semibold text-sm hover:bg-violet-50 transition-colors">
                Fechar
              </button>
              <button onClick={handleSalvar} disabled={savingKey === modalForma}
                className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-300 disabled:opacity-50 transition-colors">
                {savingKey === modalForma ? 'Salvando...' : 'Salvar'}
              </button>
              {modalFormaObj.parcelavel && (modalFormaObj as any).n < 12 && (
                <button onClick={handleSalvarProxima} disabled={savingKey === modalForma}
                  className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  Salvar & Próxima Parcela
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
