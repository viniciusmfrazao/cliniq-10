import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, patientId, clinicId, queixa, appointmentId } = await req.json()
  if (!patientId || !clinicId || !action) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
  }

  // Buscar histórico do paciente
  const { data: evolutions } = await supabase
    .from('evolutions')
    .select('type, title, content, created_at, procedure_name')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .not('appointment_id', 'eq', appointmentId) // excluir atendimento atual
    .order('created_at', { ascending: false })
    .limit(20)

  // Buscar dados do paciente
  const { data: patient } = await supabase
    .from('patients')
    .select('name, birth_date, notes')
    .eq('id', patientId)
    .single()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const historicoTexto = evolutions && evolutions.length > 0
    ? evolutions.map(e => {
        const data = new Date(e.created_at).toLocaleDateString('pt-BR')
        return `[${data}] ${e.procedure_name || e.type || 'Atendimento'}: ${e.content?.slice(0, 300) || '(sem registro)'}`
      }).join('\n')
    : 'Nenhum atendimento anterior registrado.'

  const idade = patient?.birth_date
    ? `${Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} anos`
    : 'idade não informada'

  let prompt = ''

  if (action === 'resumo') {
    prompt = `Você é um assistente médico especializado em estética. Analise o histórico abaixo e gere um resumo clínico CONCISO (máximo 4 linhas) para orientar o próximo atendimento.

Paciente: ${patient?.name || 'N/A'}, ${idade}

HISTÓRICO DE ATENDIMENTOS:
${historicoTexto}

Gere um resumo objetivo com:
- Procedimentos realizados e frequência
- Queixas recorrentes ou observações importantes
- Pontos de atenção para o próximo atendimento

Seja direto e objetivo. Use linguagem clínica simples. Máximo 4 linhas.`

  } else if (action === 'sugestao_conduta') {
    if (!queixa) return NextResponse.json({ error: 'Queixa obrigatória' }, { status: 400 })
    prompt = `Você é um assistente médico especializado em estética. Com base na queixa atual e histórico do paciente, sugira uma conduta clínica.

Paciente: ${patient?.name || 'N/A'}, ${idade}

QUEIXA ATUAL: ${queixa}

HISTÓRICO DE ATENDIMENTOS:
${historicoTexto}

Sugira uma conduta clínica objetiva (máximo 5 linhas) considerando:
- A queixa atual
- Procedimentos já realizados
- Progressão do tratamento

Seja direto. Use linguagem clínica. A profissional pode editar antes de salvar.`
  } else {
    return NextResponse.json({ error: 'Action inválida' }, { status: 400 })
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Claude API: ${err.slice(0, 200)}` }, { status: 500 })
  }

  const data = await resp.json()
  const text = data.content?.[0]?.text?.trim() || ''

  return NextResponse.json({ ok: true, result: text, tokens: data.usage })
}
