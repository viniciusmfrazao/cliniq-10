'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import * as XLSX from 'xlsx'

type PatientRow = {
  name: string
  email?: string
  phone?: string
  cpf?: string
  birth_date?: string
  gender?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  notes?: string
}

type ColumnMapping = {
  name: string
  email: string
  phone: string
  cpf: string
  birth_date: string
  gender: string
  address: string
  city: string
  state: string
  zip_code: string
  notes: string
}

const DEFAULT_MAPPING: ColumnMapping = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  birth_date: '',
  gender: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  name: 'Nome *',
  email: 'Email',
  phone: 'Telefone',
  cpf: 'CPF',
  birth_date: 'Data de Nascimento',
  gender: 'Sexo',
  address: 'Endereço',
  city: 'Cidade',
  state: 'Estado',
  zip_code: 'CEP',
  notes: 'Observações',
}

export default function ImportarPacientesPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done'>('upload')
  const [fileData, setFileData] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING)
  const [previewData, setPreviewData] = useState<PatientRow[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const workbook = XLSX.read(data, { type: 'binary' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      
      if (jsonData.length < 2) {
        alert('Arquivo vazio ou sem dados')
        return
      }

      const headers = (jsonData[0] as string[]).map(h => String(h || '').trim())
      const rows = jsonData.slice(1) as any[][]
      
      setColumns(headers)
      setFileData(rows)
      
      // Auto-mapping based on common column names
      const autoMapping = { ...DEFAULT_MAPPING }
      headers.forEach((col, idx) => {
        const colLower = col.toLowerCase()
        if (colLower.includes('nome') || colLower === 'name') autoMapping.name = col
        if (colLower.includes('email') || colLower.includes('e-mail')) autoMapping.email = col
        if (colLower.includes('telefone') || colLower.includes('phone') || colLower.includes('celular') || colLower.includes('whatsapp')) autoMapping.phone = col
        if (colLower.includes('cpf')) autoMapping.cpf = col
        if (colLower.includes('nascimento') || colLower.includes('birth') || colLower.includes('data nasc')) autoMapping.birth_date = col
        if (colLower.includes('sexo') || colLower.includes('gender') || colLower.includes('gênero')) autoMapping.gender = col
        if (colLower.includes('endereço') || colLower.includes('endereco') || colLower.includes('address') || colLower.includes('rua')) autoMapping.address = col
        if (colLower.includes('cidade') || colLower.includes('city')) autoMapping.city = col
        if (colLower.includes('estado') || colLower.includes('uf') || colLower.includes('state')) autoMapping.state = col
        if (colLower.includes('cep') || colLower.includes('zip')) autoMapping.zip_code = col
        if (colLower.includes('obs') || colLower.includes('nota') || colLower.includes('note')) autoMapping.notes = col
      })
      
      setMapping(autoMapping)
      setStep('mapping')
    }
    reader.readAsBinaryString(file)
  }

  const processMapping = () => {
    if (!mapping.name) {
      alert('O campo "Nome" é obrigatório. Selecione a coluna correspondente.')
      return
    }

    const colIndexes: Record<string, number> = {}
    columns.forEach((col, idx) => { colIndexes[col] = idx })

    const processed: PatientRow[] = fileData
      .filter(row => row && row.length > 0)
      .map(row => {
        const getValue = (field: keyof ColumnMapping) => {
          const colName = mapping[field]
          if (!colName) return undefined
          const idx = colIndexes[colName]
          if (idx === undefined) return undefined
          const val = row[idx]
          return val !== undefined && val !== null && val !== '' ? String(val).trim() : undefined
        }

        const name = getValue('name')
        if (!name) return null

        // Format phone
        let phone = getValue('phone')
        if (phone) {
          phone = phone.replace(/\D/g, '')
          if (phone.length === 11) {
            phone = `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`
          } else if (phone.length === 10) {
            phone = `(${phone.slice(0,2)}) ${phone.slice(2,6)}-${phone.slice(6)}`
          }
        }

        // Format CPF
        let cpf = getValue('cpf')
        if (cpf) {
          cpf = cpf.replace(/\D/g, '')
          if (cpf.length === 11) {
            cpf = `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`
          }
        }

        // Format birth_date
        let birth_date = getValue('birth_date')
        if (birth_date) {
          // Try to parse various date formats
          if (typeof birth_date === 'number') {
            // Excel serial date
            const date = XLSX.SSF.parse_date_code(birth_date)
            if (date) {
              birth_date = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
            }
          } else if (birth_date.includes('/')) {
            const parts = birth_date.split('/')
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                // DD/MM/YYYY
                birth_date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              } else if (parts[0].length === 4) {
                // YYYY/MM/DD
                birth_date = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
              }
            }
          }
        }

        // Format gender
        let gender = getValue('gender')
        if (gender) {
          const g = gender.toLowerCase()
          if (g.startsWith('m') || g === 'masculino' || g === 'male') gender = 'M'
          else if (g.startsWith('f') || g === 'feminino' || g === 'female') gender = 'F'
          else gender = 'O'
        }

        return {
          name,
          email: getValue('email'),
          phone,
          cpf,
          birth_date,
          gender,
          address: getValue('address'),
          city: getValue('city'),
          state: getValue('state'),
          zip_code: getValue('zip_code'),
          notes: getValue('notes'),
        }
      })
      .filter((p): p is PatientRow => p !== null)

    setPreviewData(processed)
    setStep('preview')
  }

  const startImport = async () => {
    setStep('importing')
    setImporting(true)
    setProgress({ current: 0, total: previewData.length, errors: 0 })
    setErrors([])

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Usuário não autenticado')
      return
    }

    const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!userData?.clinic_id) {
      alert('Clínica não encontrada')
      return
    }

    const clinic_id = userData.clinic_id
    const newErrors: string[] = []
    let errorCount = 0

    for (let i = 0; i < previewData.length; i++) {
      const patient = previewData[i]
      
      try {
        // Check for duplicate by phone or CPF
        let duplicate = false
        if (patient.phone) {
          const { data: existing } = await supabase
            .from('patients')
            .select('id')
            .eq('clinic_id', clinic_id)
            .eq('phone', patient.phone)
            .single()
          if (existing) duplicate = true
        }
        if (!duplicate && patient.cpf) {
          const { data: existing } = await supabase
            .from('patients')
            .select('id')
            .eq('clinic_id', clinic_id)
            .eq('cpf', patient.cpf)
            .single()
          if (existing) duplicate = true
        }

        if (duplicate) {
          newErrors.push(`Linha ${i + 2}: ${patient.name} - Paciente já cadastrado (telefone ou CPF duplicado)`)
          errorCount++
        } else {
          const { error } = await supabase.from('patients').insert({
            clinic_id,
            name: patient.name,
            email: patient.email || null,
            phone: patient.phone || null,
            cpf: patient.cpf || null,
            birth_date: patient.birth_date || null,
            gender: patient.gender as 'M' | 'F' | 'O' | null || null,
            address: patient.address || null,
            city: patient.city || null,
            state: patient.state || null,
            zip_code: patient.zip_code || null,
            notes: patient.notes || null,
          })

          if (error) {
            newErrors.push(`Linha ${i + 2}: ${patient.name} - ${error.message}`)
            errorCount++
          }
        }
      } catch (err: any) {
        newErrors.push(`Linha ${i + 2}: ${patient.name} - ${err.message}`)
        errorCount++
      }

      setProgress({ current: i + 1, total: previewData.length, errors: errorCount })
    }

    setErrors(newErrors)
    setImporting(false)
    setStep('done')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pacientes" className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1 mb-2">
          <Icon name="arrowLeft" className="w-4 h-4" />
          Voltar para Pacientes
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Importar Pacientes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importe pacientes de uma planilha Excel ou CSV
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['Upload', 'Mapeamento', 'Prévia', 'Importar'].map((label, idx) => {
          const stepNum = idx + 1
          const isActive = 
            (step === 'upload' && stepNum === 1) ||
            (step === 'mapping' && stepNum === 2) ||
            (step === 'preview' && stepNum === 3) ||
            ((step === 'importing' || step === 'done') && stepNum === 4)
          const isPast = 
            (step === 'mapping' && stepNum < 2) ||
            (step === 'preview' && stepNum < 3) ||
            ((step === 'importing' || step === 'done') && stepNum < 4)
          
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                isActive ? 'bg-violet-600 text-white' :
                isPast ? 'bg-emerald-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {isPast ? '✓' : stepNum}
              </div>
              <span className={`text-sm ${isActive ? 'text-violet-600 font-medium' : 'text-slate-500'}`}>
                {label}
              </span>
              {idx < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div 
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-violet-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="upload" className="w-8 h-8 text-violet-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">
              Arraste o arquivo ou clique para selecionar
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Suporta arquivos .xlsx, .xls e .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button className="btn-primary">
              Selecionar Arquivo
            </button>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              <strong>💡 Dica:</strong> Sua planilha deve ter uma linha de cabeçalho com os nomes das colunas 
              (ex: Nome, Telefone, Email, CPF, Data de Nascimento, etc.)
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Mapeie as colunas da planilha
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Encontramos {columns.length} colunas e {fileData.length} linhas de dados.
            Selecione qual coluna corresponde a cada campo.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(field => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {FIELD_LABELS[field]}
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                  className="input"
                >
                  <option value="">-- Não importar --</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-secondary">
              Voltar
            </button>
            <button onClick={processMapping} className="btn-primary">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Prévia da Importação
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {previewData.length} pacientes serão importados. Confira os primeiros registros:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-3 font-semibold">Nome</th>
                  <th className="text-left p-3 font-semibold">Telefone</th>
                  <th className="text-left p-3 font-semibold">Email</th>
                  <th className="text-left p-3 font-semibold">CPF</th>
                  <th className="text-left p-3 font-semibold">Nascimento</th>
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((p, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{p.phone || '-'}</td>
                    <td className="p-3">{p.email || '-'}</td>
                    <td className="p-3">{p.cpf || '-'}</td>
                    <td className="p-3">{p.birth_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewData.length > 10 && (
            <p className="text-sm text-slate-500 mt-4">
              ... e mais {previewData.length - 10} registros
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep('mapping')} className="btn-secondary">
              Voltar
            </button>
            <button onClick={startImport} className="btn-primary">
              Importar {previewData.length} Pacientes
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Icon name="upload" className="w-8 h-8 text-violet-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Importando pacientes...
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {progress.current} de {progress.total} processados
            {progress.errors > 0 && ` (${progress.errors} erros)`}
          </p>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-violet-600 h-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && (
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              errors.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'
            }`}>
              <Icon 
                name={errors.length === 0 ? 'check' : 'alert'} 
                className={`w-8 h-8 ${errors.length === 0 ? 'text-emerald-600' : 'text-amber-600'}`} 
              />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Importação Concluída!
            </h2>
            <p className="text-sm text-slate-500">
              {progress.total - progress.errors} pacientes importados com sucesso
              {progress.errors > 0 && `, ${progress.errors} com erro`}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-red-800 mb-2">Erros encontrados:</h3>
              <ul className="text-sm text-red-700 space-y-1 max-h-48 overflow-y-auto">
                {errors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/pacientes" className="btn-primary">
              Ver Pacientes
            </Link>
            <button 
              onClick={() => {
                setStep('upload')
                setFileData([])
                setColumns([])
                setMapping(DEFAULT_MAPPING)
                setPreviewData([])
                setErrors([])
              }} 
              className="btn-secondary"
            >
              Importar Mais
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
