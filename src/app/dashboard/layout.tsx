import { redirect } from 'next/navigation'
import { createClient, createServiceClient, getCachedUser } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import ChatWidget from '@/components/ui/ChatWidget'
import AppProviders from '@/components/layout/AppProviders'
import WhatsappHealthBanner from '@/components/layout/WhatsappHealthBanner'
import WhatsappHealthBannerWrapper from '@/components/layout/WhatsappHealthBannerWrapper'
import BillingOverdueBanner from '@/components/layout/BillingOverdueBanner'
import MetaBatidaCelebration from '@/components/layout/MetaBatidaCelebration'
import { FACTORY_DEFAULTS } from '@/lib/permissions'

export default async function DashboardLayout({ children, searchParams }: { children: React.ReactNode, searchParams?: { admin?: string } }) {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  // userData e super_admins só dependem de user.id — rodam em paralelo
  // (antes eram sequenciais, sem necessidade: economiza 1 round-trip)
  const [{ data: userData }, { data: sa }] = await Promise.all([
    supabase.from('users').select('name, role, clinic_id, permissions, recebe_comissao').eq('id', user.id).maybeSingle(),
    // Super admin sempre vai para /admin, mesmo que tenha clinic_id
    // Usa o client do próprio usuário (RLS: só vê o próprio registro)
    supabase.from('super_admins').select('id').eq('id', user.id).maybeSingle(),
  ])
  if (sa && searchParams?.admin !== '0') redirect('/admin')

  // Usuário sem clinic_id e sem super_admin vai para login
  if (!userData?.clinic_id) {
    redirect('/login')
  }

  // Run clinic and users queries in PARALLEL (much faster!)
  const [clinicResult, usersResult] = await Promise.all([
    supabase.from('clinics').select('name, trial_ends_at, plan_expires_at, settings, clinic_subscriptions(status)').eq('id', userData.clinic_id).single(),
    supabase.from('users').select('id, name, role').eq('clinic_id', userData.clinic_id).order('name')
  ])

  const clinic = clinicResult.data
  const clinicUsers = usersResult.data
  const activeModules = clinic?.settings?.active_modules || []
  const comissaoAtiva = !!clinic?.settings?.comissao_ativa
  let userPermissions: string[] = Array.isArray(userData?.permissions) ? userData.permissions as string[] : []
  // Sem override individual -> cai pro default do papel na clinica, ou pro factory default
  if (userPermissions.length === 0 && userData?.role && !['admin', 'super_admin'].includes(userData.role)) {
    const { data: roleDefault } = await supabase
      .from('clinic_role_defaults')
      .select('permissions')
      .eq('clinic_id', userData.clinic_id)
      .eq('role', userData.role)
      .maybeSingle()
    userPermissions = Array.isArray(roleDefault?.permissions)
      ? roleDefault!.permissions as string[]
      : FACTORY_DEFAULTS[userData.role] ?? []
  }
  // Ver "Financeiro" (e a tela "Minhas Comissões" dentro dele) não é um default fixo do
  // papel clínico — só faz sentido pra quem realmente recebe comissão. Injeta a permissão
  // dinamicamente com base no dado real do profissional, não num default estático.
  if (userData?.recebe_comissao && !userPermissions.includes('financial_view_own')) {
    userPermissions = [...userPermissions, 'financial_view_own']
  }

  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  // Bloqueio de acesso por pagamento vencido — só se aplica a clínicas que já
  // passaram pelo fluxo de assinatura Asaas (clinic_subscriptions existe).
  // Clínicas legadas (sem assinatura registrada) continuam liberadas pelo
  // trial_ends_at manual, sem risco de bloqueio por engano.
  const hasSubscription = Array.isArray(clinic?.clinic_subscriptions) && clinic.clinic_subscriptions.length > 0
  const daysOverdue = hasSubscription && clinic?.plan_expires_at
    ? Math.floor((Date.now() - new Date(clinic.plan_expires_at).getTime()) / 86400000)
    : null

  const BILLING_GRACE_DAYS = 7
  if (daysOverdue !== null && daysOverdue > BILLING_GRACE_DAYS) {
    redirect('/planos?trial_expirado=1')
  }

  return (
    <AppProviders
      userRole={userData?.role || 'viewer'}
      activeModules={activeModules}
      clinicId={userData.clinic_id}
      userId={user.id}
      comissaoAtiva={comissaoAtiva}
    >
      <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden fixed inset-0 w-full">
        <Sidebar clinicName={clinic?.name || 'Clinike'} userName={userData?.name || ''} userRole={userData?.role || 'viewer'} trialDaysLeft={trialDaysLeft} userId={user.id} activeModules={activeModules} userPermissions={userPermissions} comissaoAtiva={comissaoAtiva} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            clinicName={clinic?.name || 'Clinike'}
            userName={userData?.name || ''}
            userRole={userData?.role || 'viewer'}
            trialDaysLeft={trialDaysLeft}
            userId={user.id}
          />
          <BillingOverdueBanner
            clinicId={userData.clinic_id}
            role={userData?.role || 'viewer'}
          />
          <WhatsappHealthBannerWrapper>
            <WhatsappHealthBanner
              clinicId={userData.clinic_id}
              role={userData?.role || 'viewer'}
            />
          </WhatsappHealthBannerWrapper>
          <main className="flex-1 overflow-y-auto overflow-x-hidden pl-safe pr-safe overscroll-none">
            <div className="px-4 py-4 md:px-8 md:py-6 pb-28 md:pb-6 max-w-full">{children}</div>
          </main>
        </div>
        <BottomNav userRole={userData?.role || 'viewer'} activeModules={activeModules} userPermissions={userPermissions} />

        <MetaBatidaCelebration />

        <ChatWidget
          currentUserId={user.id}
          clinicId={userData.clinic_id}
          users={clinicUsers || []}
        />
      </div>
    </AppProviders>
  )
}

