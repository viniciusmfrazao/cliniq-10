'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Patient = {
  id: string
  name: string
  cpf?: string
  phone?: string
}

type Clinic = {
  name: string
  cnpj?: string
}

export default function ReciboPage() {
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)
  
  const [patients, setPatients] = useState<Patient[]>([])
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  
  // Form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro')
  const [observacoes, setObservacoes] = useState('')
  const [numeroRecibo, setNumeroRecibo] = useState('')
  
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadData()
    generateReceiptNumber()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!userData?.clinic_id) return

    const [patientsResult, clinicResult] = await Promise.all([
      supabase
        .from('patients')
        .select('id, name, cpf, phone')
        .eq('clinic_id', userData.clinic_id)
        .order('name')
        .limit(500),
      supabase
        .from('clinics')
        .select('name, cnpj')
        .eq('id', userData.clinic_id)
        .single()
    ])

    setPatients(patientsResult.data || [])
    setClinic(clinicResult.data)
    setLoading(false)
  }

  function generateReceiptNumber() {
    const date = new Date()
    const num = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
    setNumeroRecibo(num)
  }

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.cpf?.includes(searchQuery) ||
    p.phone?.includes(searchQuery)
  ).slice(0, 10)

  function formatCurrency(value: string) {
    const num = value.replace(/\D/g, '')
    const formatted = (parseInt(num || '0') / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
    return formatted
  }

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    setValor(raw)
  }

  function valorPorExtenso(valor: number): string {
    if (valor === 0) return 'zero reais'
    
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
    const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
    
    function extenso(n: number): string {
      if (n === 0) return ''
      if (n === 100) return 'cem'
      if (n < 10) return unidades[n]
      if (n < 20) return especiais[n - 10]
      if (n < 100) {
        const d = Math.floor(n / 10)
        const u = n % 10
        return dezenas[d] + (u ? ' e ' + unidades[u] : '')
      }
      if (n < 1000) {
        const c = Math.floor(n / 100)
        const resto = n % 100
        return centenas[c] + (resto ? ' e ' + extenso(resto) : '')
      }
      if (n < 1000000) {
        const mil = Math.floor(n / 1000)
        const resto = n % 1000
        const milTexto = mil === 1 ? 'mil' : extenso(mil) + ' mil'
        return milTexto + (resto ? ' ' + (resto < 100 ? 'e ' : '') + extenso(resto) : '')
      }
      return n.toString()
    }

    const reais = Math.floor(valor)
    const centavos = Math.round((valor - reais) * 100)
    
    let texto = ''
    if (reais > 0) {
      texto = extenso(reais) + (reais === 1 ? ' real' : ' reais')
    }
    if (centavos > 0) {
      texto += (texto ? ' e ' : '') + extenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
    }
    
    return texto
  }

  function handlePrint() {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo - ${numeroRecibo}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Times New Roman', serif; 
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .recibo {
              border: 2px solid #000;
              padding: 30px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header .numero {
              font-size: 14px;
              color: #666;
            }
            .valor-destaque {
              text-align: right;
              font-size: 24px;
              font-weight: bold;
              margin: 20px 0;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .corpo {
              line-height: 2;
              font-size: 14px;
              text-align: justify;
            }
            .corpo strong {
              text-transform: uppercase;
            }
            .extenso {
              font-style: italic;
              color: #444;
            }
            .assinatura {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              gap: 40px;
            }
            .assinatura-box {
              flex: 1;
              text-align: center;
            }
            .assinatura-linha {
              border-top: 1px solid #000;
              padding-top: 5px;
              font-size: 12px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px dashed #ccc;
              padding-top: 15px;
            }
            .data-local {
              text-align: right;
              margin-top: 20px;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; }
              .recibo { border-width: 1px; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              }
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const valorNumerico = parseInt(valor || '0') / 100
  const dataAtual = new Date().toLocaleDateString('pt-BR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/documentos" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <Icon name="arrowLeft" className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Gerador de Recibo</h1>
            <p className="text-sm text-slate-500 mt-0.5">Crie recibos para impressão e assinatura</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Dados do Recibo</h2>
          
          <div className="space-y-4">
            {/* Paciente */}
            <div className="relative">
              <label className="label">Paciente / Pagador</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl">
                  <div>
                    <p className="font-medium text-violet-900">{selectedPatient.name}</p>
                    {selectedPatient.cpf && (
                      <p className="text-xs text-violet-600">CPF: {selectedPatient.cpf}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => { setSelectedPatient(null); setSearchQuery('') }}
                    className="text-violet-600 hover:text-violet-800"
                  >
                    <Icon name="x" className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    className="input"
                    placeholder="Buscar paciente..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && searchQuery.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredPatients.length > 0 ? (
                        filteredPatients.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPatient(p); setShowDropdown(false); setSearchQuery('') }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">
                              {p.cpf && `CPF: ${p.cpf}`}
                              {p.cpf && p.phone && ' • '}
                              {p.phone}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-3 text-sm text-slate-500">Nenhum paciente encontrado</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Valor */}
            <div>
              <label className="label">Valor (R$)</label>
              <input
                type="text"
                className="input text-xl font-bold"
                placeholder="R$ 0,00"
                value={formatCurrency(valor)}
                onChange={handleValorChange}
              />
              {valorNumerico > 0 && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  {valorPorExtenso(valorNumerico)}
                </p>
              )}
            </div>

            {/* Descrição */}
            <div>
              <label className="label">Referente a</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="Ex: Consulta dermatológica, Aplicação de toxina botulínica..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="label">Forma de Pagamento</label>
              <select
                className="input"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
              >
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {/* Observações */}
            <div>
              <label className="label">Observações (opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="Informações adicionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowPreview(true)}
                disabled={!selectedPatient || !valor || !descricao}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Icon name="eye" className="w-4 h-4" />
                Visualizar
              </button>
              <button
                onClick={handlePrint}
                disabled={!selectedPatient || !valor || !descricao}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Icon name="file" className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Pré-visualização</h2>
          
          <div 
            ref={printRef}
            className="bg-white border border-slate-200 rounded-lg p-6 text-sm"
            style={{ fontFamily: 'serif' }}
          >
            <div className="recibo">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-300 pb-4 mb-4">
                <h1 className="text-2xl font-bold text-slate-900">RECIBO</h1>
                <p className="text-xs text-slate-500 mt-1">Nº {numeroRecibo}</p>
              </div>

              {/* Valor em destaque */}
              <div className="text-right mb-4">
                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(valor)}
                </span>
              </div>

              {/* Corpo */}
              <div className="leading-relaxed text-slate-700">
                <p>
                  Recebi(emos) de <strong>{selectedPatient?.name || '___________________'}</strong>
                  {selectedPatient?.cpf && <span>, CPF: <strong>{selectedPatient.cpf}</strong></span>}
                  , a importância de <strong>{formatCurrency(valor)}</strong> 
                  <span className="italic text-slate-500"> ({valorPorExtenso(valorNumerico)})</span>
                  , referente a <strong>{descricao || '___________________'}</strong>.
                </p>
                
                <p className="mt-3">
                  Forma de pagamento: <strong>{formaPagamento}</strong>
                  {observacoes && <span>. {observacoes}</span>}
                </p>

                <p className="mt-3 text-slate-500">
                  Para maior clareza, firmo(amos) o presente recibo para que produza os seus efeitos legais.
                </p>
              </div>

              {/* Data e Local */}
              <p className="text-right mt-6 text-slate-600">
                {clinic?.name || 'Local'}, {dataAtual}
              </p>

              {/* Assinaturas */}
              <div className="mt-12 flex justify-between gap-8">
                <div className="flex-1 text-center">
                  <div className="border-t border-slate-400 pt-2">
                    <p className="text-xs text-slate-600">Assinatura do Recebedor</p>
                    <p className="text-xs text-slate-500 mt-1">{clinic?.name}</p>
                    {clinic?.cnpj && <p className="text-xs text-slate-400">CNPJ: {clinic.cnpj}</p>}
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="border-t border-slate-400 pt-2">
                    <p className="text-xs text-slate-600">Assinatura do Pagador</p>
                    <p className="text-xs text-slate-500 mt-1">{selectedPatient?.name || '_______________'}</p>
                    {selectedPatient?.cpf && <p className="text-xs text-slate-400">CPF: {selectedPatient.cpf}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
