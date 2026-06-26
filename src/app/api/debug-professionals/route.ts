import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROFESSIONAL_ROLES = ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist', 'dentist']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authenticated', uid: null })

  const { data: userData } = await supabase.from('users').select('clinic_id, role').eq('id', user.id).maybeSingle()
  const clinicId = userData?.clinic_id

  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, name, role, professional_role, active')
    .eq('clinic_id', clinicId)
    .order('name')

  const professionalsFiltered = (allUsers || []).filter((u: any) =>
    (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role || '')) && u.active !== false
  )

  return NextResponse.json({
    uid: user.id,
    clinicId,
    userRole: userData?.role,
    allUsers,
    error: error?.message,
    professionalsFiltered,
    professionalsCount: professionalsFiltered.length,
  })
}
