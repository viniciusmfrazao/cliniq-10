import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import CopyAnamneseLink from './copy-link-button'

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

  // Buscar config da clínica para exibir perguntas extras
  const { data: anamneseConfig } = await supabase
    .from('anamnese_config')
    .select('perguntas_extras')
    .eq('clinic_id', anamnese.clinic_id)
    .maybeSingle()

  const perguntasExtras: Array<{ id: string; pergunta: string; tipo: string }> =
    anamneseConfig?.perguntas_extras || []

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={returnUrl} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ficha de Anamnese</h1>
          <p className="text-slate-500 dark:text-slate-400">{anamnese.patients?.name}</p>
        </div>
        {anamnese.status === 'completed' && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
            Preenchido
          </span>
        )}
      </div>

      {/* Patient info */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Dados do Paciente</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500">Nome</p>
            <p className="font-medium text-slate-900 dark:text-white">{anamnese.patients?.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Telefone</p>
            <p className="font-medium text-slate-900 dark:text-white">{anamnese.patients?.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="font-medium text-slate-900 dark:text-white">{anamnese.patients?.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Preenchido em</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {anamnese.completed_at 
                ? new Date(anamnese.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Responses */}
      {anamnese.status === 'completed' ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Procedimentos Anteriores */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Icon name="calendar" className="w-4 h-4 text-violet-600" />
              </div>
              Procedimentos Anteriores
            </h2>
            {renderResponse('Botox', responses.botox)}
            {renderResponse('Quando fez Botox', responses.botox_quando)}
            {renderResponse('Preenchimento', responses.preench)}
            {renderResponse('Quando fez preenchimento', responses.preench_quando)}
            {renderResponse('Qual preenchedor', responses.preench_qual)}
            {renderResponse('Bioestimulador', responses.bioestim)}
            {renderResponse('Quando fez bioestimulador', responses.bioestim_quando)}
            {renderResponse('Experiências anteriores', responses.experiencia)}
            {renderResponse('Descrição da experiência', responses.experiencia_desc)}
          </div>

          {/* Hábitos de Vida */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Icon name="user" className="w-4 h-4 text-emerald-600" />
              </div>
              Hábitos de Vida
            </h2>
            {renderResponse('Atividade física', responses.atividade)}
            {renderResponse('Nível de estresse', responses.estresse)}
            {renderResponse('Tabagismo', responses.tabaco)}
            {renderResponse('Cigarros por dia', responses.tabaco_qtd)}
          </div>

          {/* Alergias */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Icon name="x" className="w-4 h-4 text-red-600" />
              </div>
              Alergias
            </h2>
            {renderResponse('Alergia a Insetos', responses['alergia_Insetos'])}
            {renderResponse('Detalhes insetos', responses['alergia_Insetos_desc'])}
            {renderResponse('Alergia a Picada de Abelha', responses['alergia_Picada de Abelha'])}
            {renderResponse('Alergia a Frutos do Mar', responses['alergia_Frutos do Mar'])}
            {renderResponse('Alergia a Cosméticos', responses['alergia_Cosméticos'])}
            {renderResponse('Alergia a Anestésicos', responses['alergia_Anestésicos'])}
            {renderResponse('Outras Alergias', responses['alergia_Outras Alergias'])}
            {renderResponse('Detalhes outras alergias', responses['alergia_Outras Alergias_desc'])}
            {renderResponse('Herpes', responses.herpes)}
          </div>

          {/* Medicamentos */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Icon name="file" className="w-4 h-4 text-blue-600" />
              </div>
              Medicamentos
            </h2>
            {renderResponse('Anti-inflamatório', responses.antiinfl)}
            {renderResponse('Qual anti-inflamatório', responses.antiinfl_qual)}
            {renderResponse('Antibiótico', responses.antibio)}
            {renderResponse('Qual antibiótico', responses.antibio_qual)}
            {renderResponse('Corticóide', responses.cortic)}
            {renderResponse('Qual corticóide', responses.cortic_qual)}
            {renderResponse('Outro medicamento', responses.outroMed)}
            {renderResponse('Qual outro', responses.outroMed_qual)}
          </div>

          {/* Saúde */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icon name="user" className="w-4 h-4 text-amber-600" />
              </div>
              Saúde Geral
            </h2>
            {renderResponse('Doença auto-imune', responses.autoim)}
            {renderResponse('Qual doença auto-imune', responses.autoim_qual)}
            {renderResponse('Outra patologia', responses.outrapat)}
            {renderResponse('Qual outra patologia', responses.outrapat_qual)}
            {renderResponse('Informação adicional', responses.inforelevante)}
            {renderResponse('Descrição adicional', responses.inforelevante_desc)}
          </div>

          {/* Outras Informações */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon name="settings" className="w-4 h-4 text-slate-600" />
              </div>
              Outras Informações
            </h2>
            {renderResponse('Autoriza uso de imagem', responses.imagem)}
            {renderResponse('Aceita filmagem', responses.filmado)}
            {renderResponse('Como conheceu a clínica', responses.conheceu)}
            {renderResponse('Outro canal', responses.conheceu_outro)}
            {renderResponse('Grávida ou possibilidade', responses.gravida)}
            {renderResponse('Lactante', responses.lactante)}
          </div>

          {/* Queixa Principal */}
          <div className="card p-6 md:col-span-2">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                <Icon name="edit" className="w-4 h-4 text-pink-600" />
              </div>
              Principal Queixa
            </h2>
            {renderResponse('Áreas de interesse', responses.queixa)}
            {renderResponse('Observação', responses.queixa_obs)}
          </div>

          {/* Perguntas extras configuradas pela clínica */}
          {perguntasExtras.length > 0 && (
            <div className="card p-6 md:col-span-2">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Icon name="plus" className="w-4 h-4 text-violet-600" />
                </div>
                Informações Adicionais
              </h2>
              {perguntasExtras.map((p, idx) => {
                const val = responses[`extra_${idx}`]
                if (!val) return null
                return renderResponse(p.pergunta, val)
              })}
            </div>
          )}
        </div>
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
            Assinado em {anamnese.completed_at && new Date(anamnese.completed_at).toLocaleString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  )
}
