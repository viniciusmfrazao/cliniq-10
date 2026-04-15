import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import ChatWidget from '@/components/ui/ChatWidget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Run user query first (needed for clinic_id)
  const { data: userData } = await supabase
    .from('users').select('name, role, clinic_id').eq('id', user.id).single()

  if (!userData?.clinic_id) redirect('/login')

  // Run clinic and users queries in PARALLEL (much faster!)
  const [clinicResult, usersResult] = await Promise.all([
    supabase.from('clinics').select('name, trial_ends_at').eq('id', userData.clinic_id).single(),
    supabase.from('users').select('id, name, role').eq('clinic_id', userData.clinic_id).order('name')
  ])

  const clinic = clinicResult.data
  const clinicUsers = usersResult.data

  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar clinicName={clinic?.name || 'Cliniq'} userName={userData?.name || ''} userRole={userData?.role || 'viewer'} trialDaysLeft={trialDaysLeft} userId={user.id} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar 
          clinicName={clinic?.name || 'Cliniq'} 
          userName={userData?.name || ''} 
          userRole={userData?.role || 'viewer'}
          trialDaysLeft={trialDaysLeft}
          userId={user.id}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 md:px-8 md:py-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>
      <BottomNav userRole={userData?.role || 'viewer'} />
      
      {/* Chat Widget */}
      <ChatWidget 
        currentUserId={user.id}
        clinicId={userData.clinic_id}
        users={clinicUsers || []}
      />
    </div>
  )
}
