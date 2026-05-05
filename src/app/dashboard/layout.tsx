import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import ChatWidget from '@/components/ui/ChatWidget'
import AppProviders from '@/components/layout/AppProviders'
import WhatsappHealthBanner from '@/components/layout/WhatsappHealthBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Run user query first (needed for clinic_id)
  const { data: userData } = await supabase
    .from('users').select('name, role, clinic_id').eq('id', user.id).maybeSingle()

  // Super admin pode nao ter row em users (pode estar so em super_admins).
  // Se for o caso, redireciona pro /admin pra ele ter o painel global.
  if (!userData?.clinic_id) {
    try {
      const svc = createServiceClient()
      const { data: sa } = await svc
        .from('super_admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (sa) redirect('/admin')
    } catch {
      // Se a service role falhar nao quebra o login normal — segue pro /login
    }
    redirect('/login')
  }

  // Run clinic and users queries in PARALLEL (much faster!)
  const [clinicResult, usersResult] = await Promise.all([
    supabase.from('clinics').select('name, trial_ends_at, settings').eq('id', userData.clinic_id).single(),
    supabase.from('users').select('id, name, role').eq('clinic_id', userData.clinic_id).order('name')
  ])

  const clinic = clinicResult.data
  const clinicUsers = usersResult.data
  const activeModules = clinic?.settings?.active_modules || []

  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <AppProviders
      userRole={userData?.role || 'viewer'}
      activeModules={activeModules}
      clinicId={userData.clinic_id}
    >
      <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <Sidebar clinicName={clinic?.name || 'Clinike'} userName={userData?.name || ''} userRole={userData?.role || 'viewer'} trialDaysLeft={trialDaysLeft} userId={user.id} activeModules={activeModules} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            clinicName={clinic?.name || 'Clinike'}
            userName={userData?.name || ''}
            userRole={userData?.role || 'viewer'}
            trialDaysLeft={trialDaysLeft}
            userId={user.id}
          />
          <WhatsappHealthBanner
            clinicId={userData.clinic_id}
            role={userData?.role || 'viewer'}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pl-safe pr-safe">
            <div className="px-4 py-4 md:px-8 md:py-6 pb-28 md:pb-6 max-w-full">{children}</div>
          </main>
        </div>
        <BottomNav userRole={userData?.role || 'viewer'} activeModules={activeModules} />

        <ChatWidget
          currentUserId={user.id}
          clinicId={userData.clinic_id}
          users={clinicUsers || []}
        />
      </div>
    </AppProviders>
  )
}
