import { createClient } from '@/lib/supabase/server'
import Icon from '@/components/ui/Icon'
import PatientMarginCard from './patient-margin-card'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
}

const NF_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  emitida: { label: 'NF emitida', cls: 'bg-emerald-100 text-emerald-700' },
  processando: { label: 'NF processando', cls: 'bg-amber-100 text-amber-700' },
  erro: { label: 'NF com erro', cls: 'bg-red-100 text-red-600' },
  cancelada: { label: 'NF cancelada', cls: 'bg-slate-100 text-slate-500' },
}

/**
 * Aba Financeiro do paciente. Mostra a rentabilidade (receita − custo
 * estoque por atendimento) e, abaixo, TODAS as entradas daquele paciente
 * — incluindo vendas avulsas de produto que não passam por atendimento
 * e, portanto, não entram no card de rentabilidade.
 */
export default async function FinanceiroTab({
  patientId,
  clinicId,
}: {
  patientId: string
  clinicId: string
}) {
  const supabase = await createClient()

  const { data: entradas } = await supabase
    .from('entradas')
    .select(
      'id, data_venda, procedimento_nome, forma_pagamento, valor_bruto, valor_liquido, n_parcelas, comissao_paga, nota_fiscal_status'
    )
    .eq('paciente_id', patientId)
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })

  const totalLiquido = (entradas || []).reduce((s, e) => s + Number(e.valor_liquido || 0), 0)

  return (
    <div className="space-y-6">
      <PatientMarginCard patientId={patientId} clinicId={clinicId} />

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Entradas do paciente</h3>
            <p className="text-sm text-slate-500">
              {(entradas || []).length} lançamento{(entradas || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          {(entradas || []).length > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-400">Total líquido</p>
              <p className="text-sm font-bold text-emerald-700">{fmt(totalLiquido)}</p>
            </div>
          )}
        </div>

        {!entradas || entradas.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Icon name="dollarSign" className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma entrada registrada para este paciente ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entradas.map((e) => {
              const nf = e.nota_fiscal_status ? NF_STATUS_LABEL[e.nota_fiscal_status] : null
              return (
                <div key={e.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {e.procedimento_nome || 'Venda avulsa'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {new Date(e.data_venda).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">
                          {FORMA_LABEL[e.forma_pagamento] || e.forma_pagamento}
                          {e.n_parcelas && e.n_parcelas > 1 ? ` (${e.n_parcelas}x)` : ''}
                        </span>
                        {nf && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${nf.cls}`}>
                            {nf.label}
                          </span>
                        )}
                        {e.comissao_paga && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                            Comissão paga
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800">{fmt(Number(e.valor_liquido || 0))}</p>
                      {Number(e.valor_bruto) !== Number(e.valor_liquido) && (
                        <p className="text-xs text-slate-400">bruto {fmt(Number(e.valor_bruto || 0))}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
