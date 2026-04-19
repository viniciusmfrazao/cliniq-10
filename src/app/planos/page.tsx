import Link from 'next/link'

export default function PlanosPage({ searchParams }: { searchParams: { trial_expirado?: string } }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl mb-6">
          <span className="text-white text-xl font-bold">C</span>
        </div>

        {searchParams.trial_expirado === '1' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-sm font-medium text-amber-800">Seu periodo de trial encerrou.</p>
            <p className="text-xs text-amber-600 mt-1">Escolha um plano para continuar usando o Clinike.</p>
          </div>
        )}

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Escolha seu plano</h1>
        <p className="text-sm text-slate-500 mb-10">Sem contrato. Cancele quando quiser.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          {[
            {
              name: 'Starter', price: 'R$ 197', period: '/mes',
              highlight: false,
              features: ['Agenda inteligente', 'Cadastro de pacientes', 'Prontuario basico', '1 profissional'],
            },
            {
              name: 'Pro', price: 'R$ 397', period: '/mes',
              highlight: true,
              features: ['Tudo do Starter', 'Mapa de Injetaveis', 'Estoque inteligente', 'Docs ICP-Brasil', 'Eva IA + WhatsApp', '5 profissionais'],
            },
            {
              name: 'Clinic+', price: 'R$ 797', period: '/mes',
              highlight: false,
              features: ['Tudo do Pro', 'Voz + Transcricao', 'Avaliacao Facial IA', 'Secretaria 24h', 'Ilimitado'],
            },
          ].map(plan => (
            <div key={plan.name} className={`card p-6 ${plan.highlight ? 'border-2 border-brand-400 ring-2 ring-brand-100' : ''}`}>
              {plan.highlight && (
                <span className="inline-block text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full mb-3">
                  Mais popular
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6 text-left">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                plan.highlight
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}>
                Assinar {plan.name}
              </button>
            </div>
          ))}
        </div>

        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600">
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
