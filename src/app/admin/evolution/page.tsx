import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/super-admin'
import { getAllSettings } from '@/lib/app-settings'
import EvolutionSettingsForm from './settings-form'
import EvolutionMonitor from './monitor'

export default async function AdminEvolutionPage() {
  if (!(await isSuperAdmin())) redirect('/dashboard')

  const settings = await getAllSettings()
  const map = Object.fromEntries(settings.map(s => [s.key, s])) as Record<
    string,
    { key: string; value: string | null; is_secret: boolean; description: string | null; updated_at: string }
  >

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Evolution API</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Configurações globais do SaaS. Cada clínica usa estas credenciais para conectar seu próprio número de WhatsApp.
        </p>
      </div>

      <EvolutionSettingsForm initial={map} />

      {/* Monitor de saúde */}
      <EvolutionMonitor />

      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-semibold mb-2">⚠️ Importante</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Estas credenciais são <strong>globais</strong>. Use UMA Evolution API rodando em VPS/Railway.</li>
          <li>Cada clínica vai gerar sua própria <strong>instance</strong> dentro dessa Evolution (modelo nativo).</li>
          <li>O webhook secret é gerado uma única vez e usado para validar todos os eventos da Evolution.</li>
          <li>As clínicas <strong>não veem</strong> nem editam isso — só você, super_admin.</li>
        </ul>
      </div>
    </div>
  )
}
