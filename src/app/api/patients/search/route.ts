import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  
  if (q.length < 2) return NextResponse.json([])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, phone')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10)

  if (error) return NextResponse.json([])
  return NextResponse.json(data || [])
}
