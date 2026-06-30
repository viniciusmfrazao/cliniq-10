'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'

type Props = {
  clinicId: string
  userId: string
}

const CATEGORIAS_DRE = [
  { value: 'CMV / Insumos', desc: 'Tudo para realizar procedimentos: botox, preenchedor, materiais' },
  { value: 'Despesas com Pessoal', desc: 'Salários, comissões, pró-labore, freelancers' },
  { value: 'Despesas Administrativas', desc: 'Aluguel, luz, água, internet, sistemas, manutenção' },
  { value: 'Despesas com Vendas', desc: 'Marketing, anúncios, designer, fotógrafo' },
  { value: 'Impostos e Obrigações', desc: 'DAS, INSS, contador, anuidades, alvarás' },
  { value: 'Despesas Financeiras', desc: 'Juros, IOF, parcelas de financiamento, tarifas bancárias' },
  { value: 'Outros', desc: 'Gastos que não se encaixam nas categorias acima' },
]

const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência']
const FORMAS_COM_VENCIMENTO = ['Boleto', 'Crédito', 'Transferência']

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/** Adiciona N meses a uma data no formato YYYY-MM-DD */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export default function SaidaForm({ clinicId, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [data, setData] = useState(todayBR())
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('Pix')
  const [observacoes, setObservacoes] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [temVencimento, setTemVencimento] = useState(false)
  const [dataVencimento, setDataVencimento] = useState('')

  // Recorrência
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [mesesRecorrencia, setMesesRecorrencia] = useState(12)

  // Parcelamento (pagamento futuro em N vezes)
  const [isParcelado, setIsParcelado] = useState(false)
  const [numParcelas, setNumParcelas] = useState(2)

  const categoriaInfo = CATEGORIAS_DRE.find(c => c.value === categoria)
  const mostrarVencimento = FORMAS_COM_VENCIMENTO.includes(forma)
  const isPagamentoFuturo = temVencimento && dataVencimento && dataVencimento > todayBR()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valorNum = parseFloat(valor)
    if (!descricao.trim()) { alert('Informe a descrição'); return }
    if (!valorNum || valorNum <= 0) { alert('Informe o valor'); return }
    if (temVencimento && !dataVencimento) { alert('Informe a data de vencimento'); return }
    if (isRecorrente && (!mesesRecorrencia || mesesRecorrencia < 2)) {
      alert('Informe ao menos 2 meses para recorrência')
      return
    }

    setLoading(true)

    if (isParcelado && isPagamentoFuturo) {
      // Parcelamento: N lançamentos futuros, um por mês, rotulados "desc (1/N)"
      const registros = Array.from({ length: numParcelas }, (_, i) => ({
        clinic_id: clinicId,
        data: addMonths(dataVencimento, i),
        data_vencimento: addMonths(dataVencimento, i),
        pago: false,
        descricao: `${descricao.trim()} (${i + 1}/${numParcelas})`,
        categoria_dre: categoria || null,
        subcategoria: subcategoria || null,
        fornecedor: fornecedor.trim() || null,
        valor: valorNum,
        forma_pagamento: forma,
        observacoes: observacoes.trim() || null,
        created_by: userId,
      }))

      const { error } = await supabase.from('saidas').insert(registros)
      if (error) {
        alert('Erro ao salvar parcelas: ' + error.message)
        setLoading(false)
        return
      }
    } else if (isRecorrente) {
      // Gerar todas as ocorrências da série
      const recurrenceId = crypto.randomUUID()
      const baseData = isPagamentoFuturo ? dataVencimento : data

      const registros = Array.from({ length: mesesRecorrencia }, (_, i) => {
        const dataOcorrencia = addMonths(baseData, i)
        return {
          clinic_id: clinicId,
          data: dataOcorrencia,
          data_vencimento: dataOcorrencia,
          pago: false, // todas ficam como "a pagar" por padrão
          descricao: descricao.trim(),
          categoria_dre: categoria || null,
          subcategoria: subcategoria || null,
          fornecedor: fornecedor.trim() || null,
          valor: valorNum,
          forma_pagamento: forma,
          observacoes: observacoes.trim() || null,
          created_by: userId,
          is_recurring: true,
          recurrence_id: recurrenceId,
          recurrence_months: mesesRecorrencia,
        }
      })

      const { error } = await supabase.from('saidas').insert(registros)
      if (error) {
        alert('Erro ao salvar série: ' + error.message)
        setLoading(false)
        return
      }
    } else {
      // Insert simples (comportamento original)
      const { error } = await supabase.from('saidas').insert({
        clinic_id: clinicId,
        data: isPagamentoFuturo ? dataVencimento : data,
        data_vencimento: temVencimento ? dataVencimento : data,
        pago: !isPagamentoFuturo,
        descricao: descricao.trim(),
        categoria_dre: categoria || null,
        subcategoria: subcategoria || null,
        fornecedor: fornecedor.trim() || null,
        valor: valorNum,
        forma_pagamento: forma,
        observacoes: observacoes.trim() || null,
        created_by: userId,
      })

      if (error) {
        alert('Erro ao salvar: ' + error.message)
        setLoading(false)
        return
      }
    }

    router.push('/dashboard/financeiro/saidas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="receipt" className="w-5 h-5 text-slate-400" />
          Dados da despesa
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isPagamentoFuturo ? 'Data do lançamento (vencimento)' : 'Data *'}
            </label>
            <input
              type="date"
              value={isPagamentoFuturo ? dataVencimento : data}
              onChange={e => isPagamentoFuturo ? setDataVencimento(e.target.value) : setData(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
            <input
              type="text"
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
              placeholder="Nome do fornecedor"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
          <input
            type="text"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            required
            placeholder="Ex: Compra de materiais, Conta de luz, Salário..."
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria DRE *</label>
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          >
            <option value="">Selecione a categoria</option>
            {CATEGORIAS_DRE.map(c => (
              <option key={c.value} value={c.value}>{c.value}</option>
            ))}
          </select>
          {categoriaInfo && (
            <p className="mt-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              💡 {categoriaInfo.desc}
            </p>
          )}
        </div>

        {categoria === 'Despesas Administrativas' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de aluguel</label>
            <select
              value={subcategoria}
              onChange={e => setSubcategoria(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="">Nenhum (despesa administrativa comum)</option>
              <option value="aluguel_sala">Aluguel de sala (rateado por dia)</option>
              <option value="aluguel_mensal">Aluguel mensal (rateado por mês)</option>
            </select>
            {subcategoria === 'aluguel_sala' && (
              <p className="mt-2 text-sm text-slate-500 bg-amber-50 rounded-lg px-3 py-2">
                💡 O custo será dividido pelos atendimentos realizados neste dia.
              </p>
            )}
            {subcategoria === 'aluguel_mensal' && (
              <p className="mt-2 text-sm text-slate-500 bg-blue-50 rounded-lg px-3 py-2">
                💡 O custo será dividido pelos atendimentos do mês.
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Forma de pagamento *</label>
            <select
              value={forma}
              onChange={e => { setForma(e.target.value); setTemVencimento(false) }}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              {FORMAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={e => setValor(e.target.value)}
              required
              placeholder="0,00"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-lg font-semibold"
            />
          </div>
        </div>

        {/* Vencimento futuro */}
        {mostrarVencimento && !isRecorrente && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={temVencimento}
                onChange={e => { setTemVencimento(e.target.checked); if (!e.target.checked) { setIsParcelado(false) } }}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm font-medium text-amber-800">
                📅 Tem data de vencimento futura?
              </span>
            </label>
            {temVencimento && (
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-1">Data de vencimento</label>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={e => setDataVencimento(e.target.value)}
                  min={todayBR()}
                  className="w-full px-4 py-2.5 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                />
                {isPagamentoFuturo && (
                  <p className="mt-2 text-xs text-amber-700">
                    ⚡ Este lançamento ficará em <strong>A Pagar</strong> até você marcar como pago.
                  </p>
                )}

                {/* Parcelamento — aparece assim que vencimento está marcado */}
                <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isParcelado}
                      onChange={e => { setIsParcelado(e.target.checked); setNumParcelas(2) }}
                      className="w-4 h-4 rounded accent-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">
                      💳 Parcelado em várias vezes?
                    </span>
                  </label>
                  {isParcelado && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={2}
                          max={48}
                          value={numParcelas}
                          onChange={e => setNumParcelas(Number(e.target.value))}
                          className="w-24 px-3 py-2 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-center font-semibold"
                        />
                        <span className="text-sm text-amber-700">parcelas</span>
                        <div className="flex gap-2">
                          {[2, 3, 6, 10, 12].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNumParcelas(n)}
                              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                                numParcelas === n
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              {n}x
                            </button>
                          ))}
                        </div>
                      </div>
                      {parseFloat(valor) > 0 && dataVencimento && (
                        <div className="bg-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800">
                          📊 Serão criados <strong>{numParcelas} lançamentos</strong> de{' '}
                          <strong>{fmt(parseFloat(valor))}</strong> cada, totalizando{' '}
                          <strong>{fmt(parseFloat(valor) * numParcelas)}</strong>, com vencimentos mensais a partir de {new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toggle: Despesa fixa/recorrente */}
        <div className={`rounded-xl p-4 border space-y-3 transition-colors ${
          isRecorrente
            ? 'bg-violet-50 border-violet-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsRecorrente(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                isRecorrente ? 'bg-violet-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isRecorrente ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
            <div>
              <span className={`text-sm font-semibold ${isRecorrente ? 'text-violet-800' : 'text-slate-700'}`}>
                🔁 Despesa fixa / recorrente
              </span>
              <p className={`text-xs mt-0.5 ${isRecorrente ? 'text-violet-600' : 'text-slate-500'}`}>
                Aluguel, internet, salário fixo, assinaturas...
              </p>
            </div>
          </label>

          {isRecorrente && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-sm font-medium text-violet-800 mb-1">
                  Repetir por quantos meses?
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={mesesRecorrencia}
                    onChange={e => setMesesRecorrencia(Number(e.target.value))}
                    className="w-28 px-4 py-2.5 border border-violet-300 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white text-center font-semibold"
                  />
                  <span className="text-sm text-violet-700">meses</span>
                  <div className="flex gap-2">
                    {[3, 6, 12].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMesesRecorrencia(m)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition ${
                          mesesRecorrencia === m
                            ? 'bg-violet-600 text-white'
                            : 'bg-white border border-violet-300 text-violet-700 hover:bg-violet-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {parseFloat(valor) > 0 && mesesRecorrencia >= 2 && (
                <div className="bg-violet-100 rounded-lg px-3 py-2 text-sm text-violet-800">
                  📊 Serão criados <strong>{mesesRecorrencia} lançamentos</strong> de{' '}
                  <strong>{fmt(parseFloat(valor))}</strong> cada, totalizando{' '}
                  <strong>{fmt(parseFloat(valor) * mesesRecorrencia)}</strong> ao longo de{' '}
                  {mesesRecorrencia} meses.
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            placeholder="Observações opcionais..."
          />
        </div>
      </div>

      {parseFloat(valor) > 0 && (
        <div className={`rounded-2xl p-4 border ${
          isRecorrente
            ? 'bg-violet-50 border-violet-200'
            : isPagamentoFuturo
            ? 'bg-amber-50 border-amber-200'
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${
              isRecorrente ? 'text-violet-700'
              : isPagamentoFuturo ? 'text-amber-700' : 'text-rose-700'
            }`}>
              {isRecorrente
                ? `🔁 ${mesesRecorrencia} meses × ${fmt(parseFloat(valor))}`
                : isPagamentoFuturo ? '📅 Pagamento a vencer' : 'Valor da saída'}
            </span>
            <span className={`text-2xl font-bold ${
              isRecorrente ? 'text-violet-700'
              : isPagamentoFuturo ? 'text-amber-700' : 'text-rose-700'
            }`}>
              -{fmt(isRecorrente ? parseFloat(valor) * mesesRecorrencia : parseFloat(valor))}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Icon name="loader" className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" className="w-5 h-5" />
              {isRecorrente
                ? `Criar ${mesesRecorrencia} lançamentos`
                : isPagamentoFuturo ? 'Agendar Pagamento' : 'Lançar Saída'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
