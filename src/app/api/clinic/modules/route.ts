import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ active_modules: [] })

  const { data: userData } = await supabase
    .from('users').select('clinic_id').eq('id', user.id).single()
  if (!userData?.clinic_id) return NextResponse.json({ active_modules: [] })

  const { data: clinic } = await supabase
    .from('clinics').select('settings').eq('id', userData.clinic_id).single()

  return NextResponse.json({
    active_modules: clinic?.settings?.active_modules || []
  })
}
