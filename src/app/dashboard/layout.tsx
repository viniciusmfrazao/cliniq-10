import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('name, role, clinic_id').eq('id', user.id).single()

  const { data: clinic } = await supabase
    .from('clinics').select('name, trial_ends_at').eq('id', userData?.clinic_id).single()

  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        clinicName={clinic?.name || 'Cliniq'} 
        userName={userData?.name || ''} 
        userRole={userData?.role || 'viewer'} 
        trialDaysLeft={trialDaysLeft}
        userId={user.id}
        clinicId={userData?.clinic_id || ''}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar clinicName={clinic?.name || 'Cliniq'} userName={userData?.name || ''} trialDaysLeft={trialDaysLeft} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 md:px-8 md:py-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>
      <BottomNav userRole={userData?.role || 'viewer'} />
    </div>
  )
}
