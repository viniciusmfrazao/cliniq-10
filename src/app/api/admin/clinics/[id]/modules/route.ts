import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { modules } = body

    if (!Array.isArray(modules)) {
      return NextResponse.json({ error: 'Módulos inválidos' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current clinic settings
    const { data: clinic } = await supabase
      .from('clinics')
      .select('settings')
      .eq('id', id)
      .maybeSingle()

    const currentSettings = clinic?.settings || {}

    // Update settings with new modules
    const { error } = await supabase
      .from('clinics')
      .update({
        settings: {
          ...currentSettings,
          active_modules: modules
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating modules:', error)
      return NextResponse.json({ error: 'Erro ao atualizar módulos' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
