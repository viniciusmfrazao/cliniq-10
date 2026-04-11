import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Webhook para receber dados do n8n (ex: respostas do WhatsApp)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data } = body

    const supabase = await createClient()

    switch (event) {
      case 'whatsapp_message_received':
        // Mensagem recebida do WhatsApp - criar lead ou atualizar conversa
        if (data.phone && data.message) {
          // Verificar se é paciente existente
          const { data: patient } = await supabase
            .from('patients')
            .select('id, name')
            .eq('phone', data.phone)
            .single()

          if (patient) {
            // Paciente existe - pode logar a interação
            console.log(`Mensagem de ${patient.name}: ${data.message}`)
          } else {
            // Novo lead - criar no CRM
            const { data: clinicData } = await supabase
              .from('clinics')
              .select('id')
              .limit(1)
              .single()

            if (clinicData) {
              await supabase.from('leads').insert({
                clinic_id: clinicData.id,
                name: data.name || 'Lead WhatsApp',
                phone: data.phone,
                source: 'whatsapp',
                stage: 'new',
                notes: `Primeira mensagem: ${data.message}`,
              })
            }
          }
        }
        break

      case 'appointment_confirmed':
        // Paciente confirmou pelo WhatsApp
        if (data.appointment_id) {
          await supabase
            .from('appointments')
            .update({ status: 'confirmed' })
            .eq('id', data.appointment_id)
        }
        break

      case 'appointment_cancelled':
        // Paciente cancelou pelo WhatsApp
        if (data.appointment_id) {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', data.appointment_id)
        }
        break

      default:
        console.log('Evento não tratado:', event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro no webhook n8n:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET para testar se o webhook está funcionando
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Webhook n8n ativo',
    events: [
      'whatsapp_message_received',
      'appointment_confirmed', 
      'appointment_cancelled'
    ]
  })
}
