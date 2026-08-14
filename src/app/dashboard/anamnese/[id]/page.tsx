import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import CopyAnamneseLink from './copy-link-button'
import ExportAnamnesePdfButton from './export-pdf-button'
import CopyHashButton from '@/components/ui/CopyHashButton'

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default async function AnamneseDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { return?: string } }) {
  const { id } = params
  const returnUrl = searchParams.return || '/dashboard/anamnese'
  const supabase = await createClient()
  const user = await getCachedUser()
  
  if (!user) redirect('/login')
  
  const { data: anamnese, error } = await supabase
    .from('anamneses')
    .select('*, patients(name, phone, email, cpf, birth_date), clinics(name)')
    .eq('id', id)
    .maybeSingle()
  
  if (error || !anamnese) notFound()

  // O select aninhado pode voltar null se a relação não resolver; nesse caso
  // busca o paciente direto pra garantir nome/CPF/nascimento no cabeçalho.
  type PatientInfo = { name: string | null; phone: string | null; email: string | null; cpf: string | null; birth_date: string | null }
  let patient: PatientInfo | null = (anamnese.patients as PatientInfo | null) || null
  if (!patient && anamnese.patient_id) {
    const { data: p } = await supabase
      .from('patients')
      .select('name, phone, email, cpf, birth_date')
      .eq('id', anamnese.patient_id)
      .maybeSingle()
    patient = (p as PatientInfo | null) || null
  }

  const formatCpf = (value?: string | null): string | null => {
    if (!value) return null
    const digits = String(value).replace(/\D/g, '')
    if (digits.length !== 11) return String(value)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatDateBR = (value?: string | null): string | null => {
    if (!value) return null
    const [y, m, d] = String(value).slice(0, 10).split('-')
    return y && m && d ? `${d}/${m}/${y}` : String(value)
  }

  const patientName = patient?.name || 'Paciente'
  const patientCpf = formatCpf(patient?.cpf)
  const patientBirthDate = formatDateBR(patient?.birth_date)

  // Buscar config da clínica para exibir perguntas extras
  const { data: anamneseConfig } = await supabase
    .from('anamnese_config')
    .select('perguntas_extras')
    .eq('clinic_id', anamnese.clinic_id)
    .maybeSingle()

  const perguntasExtras: Array<{ id: string; pergunta: string; tipo: string }> =
    anamneseConfig?.perguntas_extras || []

  // Ficha respondida com um modelo customizado (builder livre) — busca o
  // template e os campos pra montar as seções dinamicamente em vez de usar
  // as seções fixas hardcoded abaixo.
  type TemplateFieldRow = {
    id: string
    secao: string
    ordem: number
    label: string
    tipo: string
    opcoes: string[] | null
  }
  let templateInfo: { nome: string; descricao: string | null } | null = null
  let templateFields: TemplateFieldRow[] = []
  if (anamnese.template_id) {
    const { data: tmpl } = await supabase
      .from('anamnese_templates')
      .select('nome, descricao')
      .eq('id', anamnese.template_id)
      .maybeSingle()
    templateInfo = tmpl || null

    const { data: tFields } = await supabase
      .from('anamnese_template_fields')
      .select('id, secao, ordem, label, tipo, opcoes')
      .eq('template_id', anamnese.template_id)
      .order('ordem', { ascending: true })
    templateFields = tFields || []
  }

  const templateSecoes = Array.from(new Set(templateFields.map((f) => f.secao)))

  const responses = anamnese.responses || {}

  const renderResponse = (label: string, value: any) => {
    if (!value) return null
    if (Array.isArray(value)) {
      return (
        <div className="py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <div className="flex flex-wrap gap-2">
            {value.map((v, i) => (
              <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm text-slate-700 dark:text-slate-300">{v}</span>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="text-slate-900 dark:text-white">{value}</p>
      </div>
    )
  }

  // Config data-driven das seções, reaproveitada para montar o HTML de
  // exportação em PDF (evita duplicar a lista de campos em dois lugares).
  const sections: Array<{ title: string; fields: Array<[string, any]> }> = anamnese.template_id
    ? templateSecoes.map((secao) => ({
        title: secao,
        fields: templateFields
          .filter((f) => f.secao === secao)
          .map((f): [string, any] => [f.label, responses[f.id]]),
      }))
    : [
    {
      title: 'Procedimentos Anteriores',
      fields: [
        ['Botox', responses.botox],
        ['Quando fez Botox', responses.botox_quando],
        ['Preenchimento', responses.preench],
        ['Quando fez preenchimento', responses.preench_quando],
        ['Qual preenchedor', responses.preench_qual],
        ['Bioestimulador', responses.bioestim],
        ['Quando fez bioestimulador', responses.bioestim_quando],
        ['Experiências anteriores', responses.experiencia],
        ['Descrição da experiência', responses.experiencia_desc],
      ],
    },
    {
      title: 'Hábitos de Vida',
      fields: [
        ['Atividade física', responses.atividade],
        ['Nível de estresse', responses.estresse],
        ['Tabagismo', responses.tabaco],
        ['Cigarros por dia', responses.tabaco_qtd],
      ],
    },
    {
      title: 'Alergias',
      fields: [
        ['Alergia a Insetos', responses['alergia_Insetos']],
        ['Detalhes insetos', responses['alergia_Insetos_desc']],
        ['Alergia a Picada de Abelha', responses['alergia_Picada de Abelha']],
        ['Detalhes picada de abelha', responses['alergia_Picada de Abelha_desc']],
        ['Alergia a Frutos do Mar', responses['alergia_Frutos do Mar']],
        ['Detalhes frutos do mar', responses['alergia_Frutos do Mar_desc']],
        ['Alergia a Cosméticos', responses['alergia_Cosméticos']],
        ['Detalhes cosméticos', responses['alergia_Cosméticos_desc']],
        ['Alergia a Anestésicos', responses['alergia_Anestésicos']],
        ['Detalhes anestésicos', responses['alergia_Anestésicos_desc']],
        ['Outras Alergias', responses['alergia_Outras Alergias']],
        ['Detalhes outras alergias', responses['alergia_Outras Alergias_desc']],
        ['Herpes', responses.herpes],
      ],
    },
    {
      title: 'Medicamentos',
      fields: [
        ['Anti-inflamatório', responses.antiinfl],
        ['Qual anti-inflamatório', responses.antiinfl_qual],
        ['Antibiótico', responses.antibio],
        ['Qual antibiótico', responses.antibio_qual],
        ['Corticóide', responses.cortic],
        ['Qual corticóide', responses.cortic_qual],
        ['Outro medicamento', responses.outroMed],
        ['Qual outro', responses.outroMed_qual],
      ],
    },
    {
      title: 'Saúde Geral',
      fields: [
        ['Doença auto-imune', responses.autoim],
        ['Qual doença auto-imune', responses.autoim_qual],
        ['Outra patologia', responses.outrapat],
        ['Qual outra patologia', responses.outrapat_qual],
        ['Informação adicional', responses.inforelevante],
        ['Descrição adicional', responses.inforelevante_desc],
      ],
    },
    {
      title: 'Outras Informações',
      fields: [
        ['Autoriza uso de imagem', responses.imagem],
        ['Aceita filmagem', responses.filmado],
        ['Como conheceu a clínica', responses.conheceu],
        ['Outro canal', responses.conheceu_outro],
        ['Grávida ou possibilidade', responses.gravida],
        ['Lactante', responses.lactante],
      ],
    },
    {
      title: 'Principal Queixa',
      fields: [
        ['Áreas de interesse', responses.queixa],
        ['Observação', responses.queixa_obs],
      ],
    },
  ]

  if (!anamnese.template_id && perguntasExtras.length > 0) {
    sections.push({
      title: 'Informações Adicionais',
      fields: perguntasExtras.map((p, idx) => [p.pergunta, responses[`extra_${idx}`]]),
    })
  }

  // Metadados visuais por seção (ícone/cor). Fica fora do array de dados pra
  // que tela e PDF usem exatamente a mesma lista de campos.
  type SectionMeta = { icon: string; iconBg: string; iconColor: string; wide?: boolean }
  const SECTION_META: Record<string, SectionMeta> = {
    'Procedimentos Anteriores': { icon: 'calendar', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
    'Hábitos de Vida': { icon: 'user', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    'Alergias': { icon: 'x', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
    'Medicamentos': { icon: 'file', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    'Saúde Geral': { icon: 'user', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    'Outras Informações': { icon: 'settings', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
    'Principal Queixa': { icon: 'edit', iconBg: 'bg-pink-100', iconColor: 'text-pink-600', wide: true },
    'Informações Adicionais': { icon: 'plus', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', wide: true },
  }
  const DEFAULT_SECTION_META: SectionMeta = { icon: 'file', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' }

  // Seções desativadas em /dashboard/anamnese/configurar nunca chegam a ser
  // exibidas ao paciente, então não têm resposta. Campos sem resposta são
  // removidos da tela E do PDF em vez de sair como "-".
  const hasValue = (value: any): boolean => {
    if (Array.isArray(value)) return value.length > 0
    if (value === null || value === undefined) return false
    return String(value).trim() !== ''
  }

  const visibleSections = sections
    .map((s) => ({ ...s, fields: s.fields.filter(([, value]) => hasValue(value)) }))
    .filter((s) => s.fields.length > 0)

  const htmlFieldValue = (value: any): string => {
    if (Array.isArray(value)) return value.length ? value.map(escapeHtml).join(', ') : '-'
    return value ? escapeHtml(value) : '-'
  }

  const completedAtLabel = anamnese.completed_at
    ? new Date(anamnese.completed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '-'

  // Termo de consentimento — só existe quando cadastrado especificamente
  // nesse registro (anamnese.consent_term_text), não afeta outras fichas.
  const fillConsentVars = (content: string): string => {
    const dt = anamnese.completed_at ? new Date(anamnese.completed_at) : new Date()
    const vars: Record<string, string> = {
      PACIENTE_NOME: patient?.name || '',
      DATA: dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      HORA: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      CLINICA_NOME: anamnese.clinics?.name || '',
    }
    return content
      .replace(/\{\{([\w_]+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
      .replace(/\{([\w_]+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
  }
  const consentText: string | null = anamnese.consent_term_text
    ? fillConsentVars(anamnese.consent_term_text)
    : null

  const bodyHtml = anamnese.status === 'completed'
    ? visibleSections
        .map(s => `
          <div class="section">
            <h2>${escapeHtml(s.title)}</h2>
            ${s.fields.map(([label, value]) => `
              <div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${htmlFieldValue(value)}</span></div>
            `).join('')}
          </div>
        `).join('') + (anamnese.consent_term_text ? `
          <div class="section" style="page-break-before: always;">
            <h2>Termo de Consentimento</h2>
            <p style="white-space: pre-wrap; font-size: 12px; line-height: 1.6;">${escapeHtml(fillConsentVars(anamnese.consent_term_text))}</p>
          </div>
        ` : '')
    : '<p>Ficha ainda não preenchida pelo paciente.</p>'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={returnUrl} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ficha de Anamnese</h1>
          <p className="text-slate-500 dark:text-slate-400">{patient?.name}</p>
        </div>
        {anamnese.status === 'completed' && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
            Preenchido
          </span>
        )}
        <ExportAnamnesePdfButton
          patientName={patientName}
          patientCpf={patientCpf}
          patientBirthDate={patientBirthDate}
          clinicName={anamnese.clinics?.name || 'Clínica'}
          completedAtLabel={completedAtLabel}
          signatureIp={anamnese.signature_ip || null}
          signatureUserAgent={anamnese.signature_user_agent || null}
          signatureCountry={anamnese.signature_country || null}
          signatureDataUrl={anamnese.signature_data || null}
          bodyHtml={bodyHtml}
        />
      </div>

      {/* Patient info */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Dados do Paciente</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500">Nome</p>
            <p className="font-medium text-slate-900 dark:text-white">{patient?.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Telefone</p>
            <p className="font-medium text-slate-900 dark:text-white">{patient?.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="font-medium text-slate-900 dark:text-white">{patient?.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Preenchido em</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {anamnese.completed_at 
                ? new Date(anamnese.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Responses */}
      {anamnese.status === 'completed' ? (
        visibleSections.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">Nenhuma resposta registrada nesta ficha.</p>
          </div>
        ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {templateInfo && (
            <div className="card p-4 md:col-span-2 bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                Ficha preenchida com o modelo customizado <strong>{templateInfo.nome}</strong>
                {templateInfo.descricao ? ` — ${templateInfo.descricao}` : ''}.
              </p>
            </div>
          )}
          {visibleSections.map((s) => {
            const meta = SECTION_META[s.title] || DEFAULT_SECTION_META
            return (
              <div key={s.title} className={`card p-6${meta.wide ? ' md:col-span-2' : ''}`}>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                    <Icon name={meta.icon as any} className={`w-4 h-4 ${meta.iconColor}`} />
                  </div>
                  {s.title}
                </h2>
                {s.fields.map(([label, value], idx) => (
                  <div key={`${s.title}-${idx}`}>{renderResponse(label, value)}</div>
                ))}
              </div>
            )
          })}
        </div>
        )
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Icon name="clock" className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Aguardando preenchimento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">O paciente ainda não preencheu esta ficha.</p>
          <CopyAnamneseLink token={anamnese.token} />
        </div>
      )}

      {/* Termo de Consentimento — exclusivo de fichas com consent_term_text preenchido */}
      {consentText && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="shield" className="w-4 h-4 text-amber-600" />
            </div>
            Termo de Consentimento
          </h2>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
            {consentText}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Aceito junto com a assinatura desta ficha, em {completedAtLabel}
          </p>
        </div>
      )}

      {/* Assinatura */}
      {anamnese.signature_data && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Assinatura Digital</h2>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 inline-block">
            <img 
              src={anamnese.signature_data} 
              alt="Assinatura" 
              className="max-w-xs h-auto"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Assinado em {completedAtLabel}
          </p>

          {/* Metadados evidenciários da assinatura eletrônica (Lei 14.063/2020) */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Icon name="globe" className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Endereço IP</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{anamnese.signature_ip || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="clock" className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Data e hora</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{completedAtLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="mapPin" className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">País</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{anamnese.signature_country || '-'}</p>
              </div>
            </div>
            {anamnese.signature_user_agent && (
              <div className="sm:col-span-3">
                <p className="text-xs text-slate-500 mb-1">Dispositivo</p>
                <p className="text-xs text-slate-400 break-all">{anamnese.signature_user_agent}</p>
              </div>
            )}
            {(anamnese.signature_lat && anamnese.signature_lon) && (
              <div className="flex items-center gap-2">
                <Icon name="mapPin" className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Localização (GPS)</p>
                  <a
                    href={`https://www.google.com/maps?q=${anamnese.signature_lat},${anamnese.signature_lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-violet-600 hover:underline"
                  >
                    {Number(anamnese.signature_lat).toFixed(5)}, {Number(anamnese.signature_lon).toFixed(5)}
                  </a>
                </div>
              </div>
            )}
            {anamnese.signature_hash && (
              <div className="sm:col-span-3">
                <p className="text-xs text-slate-500 mb-1">Hash de integridade (SHA-256)</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-400 font-mono break-all">{anamnese.signature_hash}</p>
                  <CopyHashButton hash={anamnese.signature_hash} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
