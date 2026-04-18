import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Webhook para receber dados do n8n (ex: respostas do WhatsApp)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data, clinic_id } = body

    // Usar service client para bypass de RLS em webhooks
    const supabase = createServiceClient()

    // clinic_id é obrigatório para segurança
    if (!clinic_id) {
      return NextResponse.json({ error: 'clinic_id é obrigatório' }, { status: 400 })
    }

    // Validar se a clínica existe
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id')
      .eq('id', clinic_id)
      .single()

    if (!clinic) {
      return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
    }

    switch (event) {
      case 'whatsapp_message_received':
        // Mensagem recebida do WhatsApp - criar lead ou atualizar conversa
        if (data.phone && data.message) {
          // Verificar se é paciente existente NA MESMA CLÍNICA
          const { data: patient } = await supabase
            .from('patients')
            .select('id, name')
            .eq('clinic_id', clinic_id)
            .eq('phone', data.phone)
            .single()

          if (patient) {
            // Paciente existe - pode logar a interação
            console.log(`[Clínica ${clinic_id}] Mensagem de ${patient.name}: ${data.message}`)
          } else {
            // Verificar se já existe lead com esse telefone
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('clinic_id', clinic_id)
              .eq('phone', data.phone)
              .single()

            if (!existingLead) {
              // Novo lead - criar no CRM
              await supabase.from('leads').insert({
                clinic_id: clinic_id,
                name: data.name || 'Lead WhatsApp',
                phone: data.phone,
                source: 'whatsapp',
                status: 'new',
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
            .eq('clinic_id', clinic_id)
        }
        break

      case 'appointment_cancelled':
        // Paciente cancelou pelo WhatsApp
        if (data.appointment_id) {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', data.appointment_id)
            .eq('clinic_id', clinic_id)
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
