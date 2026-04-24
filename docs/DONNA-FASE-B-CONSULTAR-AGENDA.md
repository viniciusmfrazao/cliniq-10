# Donna — Fase B (v2): `consultar_agenda` via RPC

Versão **atualizada** após criação da tela de horários no dashboard.

> A abordagem anterior (hardcode de horários das Dras no JS do N8N)
> foi substituída por uma **função SQL centralizada** (`get_available_slots`)
> que é a **single source of truth** tanto pro dashboard quanto pra Donna.

---

## 1. Pré-requisitos

1. Rodar `supabase-horarios.sql` no Supabase SQL Editor (uma vez).
2. Acessar `/dashboard/equipe` como admin e configurar os horários de cada profissional
   (ícone de relógio no card).
3. Opcional: cadastrar férias/folgas (ícone de calendário).

---

## 2. Arquitetura da nova `consultar_agenda`

```
Paciente → Donna (Claude)
                │
                ▼
         tool_use: consultar_agenda
                │
                ▼
   10b · Extrair Tool Input1 (Code)
   - parsea "amanhã", "terça", "15/05" → data YYYY-MM-DD
   - detecta período "manhã/tarde/noite"
                │
                ▼
   12a · Chamar RPC get_available_slots (HTTP Request)
   - POST /rest/v1/rpc/get_available_slots
                │
                ▼
   12b · Formatar Resposta p/ Claude (Code)
   - agrupa slots por profissional
   - monta string humana
                │
                ▼
   13 · Claude com tool_result (HTTP Request)
```

---

## 3. Node `10b · Extrair Tool Input1` (Code)

```javascript
const claudeResponse = $json;
const toolUseBlock = claudeResponse.content.find(b => b.type === 'tool_use');
if (!toolUseBlock) throw new Error('Nenhum tool_use encontrado');

const ctx = $('08 · Montar Contexto1').first().json;
const periodo = toolUseBlock.input.periodo || 'hoje';

// Parser de data em linguagem natural
const tz = 'America/Sao_Paulo';
const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

function parseData(texto) {
  const t = String(texto || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();

  const d = new Date(now);

  if (t.includes('hoje')) return d;
  if (t.includes('amanha')) { d.setDate(d.getDate() + 1); return d; }
  if (t.includes('depois de amanha')) { d.setDate(d.getDate() + 2); return d; }

  const diasSemana = {
    'domingo': 0, 'segunda': 1, 'terca': 2,
    'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
  };
  for (const [dia, num] of Object.entries(diasSemana)) {
    if (t.includes(dia)) {
      const diff = ((num - d.getDay()) + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  const m1 = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m1) {
    const dia = parseInt(m1[1]);
    const mes = parseInt(m1[2]) - 1;
    let ano = m1[3] ? parseInt(m1[3]) : d.getFullYear();
    if (ano < 100) ano += 2000;
    const p = new Date(ano, mes, dia);
    if (p < now && !m1[3]) p.setFullYear(ano + 1);
    return p;
  }

  const m2 = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));

  d.setDate(d.getDate() + 1);
  return d;
}

function detectarPeriodo(texto) {
  const t = String(texto || '').toLowerCase();
  if (t.includes('manha') || t.includes('manhã')) return 'manha';
  if (t.includes('tarde')) return 'tarde';
  if (t.includes('noite')) return 'noite';
  return null;
}

const dataAlvo = parseData(periodo);
const periodoAlvo = detectarPeriodo(periodo);

const ano = dataAlvo.getFullYear();
const mes = String(dataAlvo.getMonth() + 1).padStart(2, '0');
const dia = String(dataAlvo.getDate()).padStart(2, '0');
const dataStr = `${ano}-${mes}-${dia}`;

const clinicId = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';
const SUPABASE_URL = 'https://yqrjbyaucimvmzpfipgs.supabase.co';

// Body da RPC
const rpcBody = {
  p_clinic_id: clinicId,
  p_date: dataStr,
  p_professional_id: null,     // null = todos profissionais
  p_duration_min: 30,
  p_period: periodoAlvo        // null, 'manha', 'tarde' ou 'noite'
};

return [{
  toolUseId: toolUseBlock.id,
  periodo,
  dataAlvo: dataStr,
  periodoAlvo,
  rpcUrl: `${SUPABASE_URL}/rest/v1/rpc/get_available_slots`,
  rpcBody,
  phone: ctx.phone,
  userText: ctx.userText,
  customerName: ctx.customerName,
  convId: ctx.convId,
  isNewConversation: ctx.isNewConversation,
  messagesForClaude: ctx.messagesForClaude,
  systemPrompt: ctx.systemPrompt,
  supabasePatchUrl: ctx.supabasePatchUrl,
  supabasePostUrl: ctx.supabasePostUrl,
  claudeContentBlocks: claudeResponse.content
}];
```

---

## 4. Node `12a · Chamar RPC` (HTTP Request)

- **Method**: `POST`
- **URL**: `{{ $json.rpcUrl }}`
- **Send Headers**: ON
  - `apikey`: `={{ $vars.SUPABASE_SERVICE_KEY }}` (ou hardcode se ainda não usa vars)
  - `Authorization`: `=Bearer {{ $vars.SUPABASE_SERVICE_KEY }}`
  - `Content-Type`: `application/json`
- **Send Body**: ON
  - Body Content Type: JSON
  - Specify Body: Using JSON
  - JSON: `={{ $json.rpcBody }}`

### Resposta esperada

```json
[
  {
    "professional_id": "uuid-amanda",
    "professional_name": "Dra. Amanda",
    "slot_time": "09:00:00",
    "slot_datetime": "2026-05-15T09:00:00-03:00"
  },
  {
    "professional_id": "uuid-amanda",
    "professional_name": "Dra. Amanda",
    "slot_time": "09:30:00",
    "slot_datetime": "2026-05-15T09:30:00-03:00"
  },
  ...
]
```

---

## 5. Node `12b · Formatar Resposta p/ Claude` (Code)

```javascript
const toolCtx = $('10b · Extrair Tool Input1').first().json;

const httpResp = $input.first().json;
const slots = Array.isArray(httpResp)
  ? httpResp
  : (Array.isArray(httpResp?.body) ? httpResp.body : []);

// Agrupar por profissional
const porProfissional = new Map();
for (const s of slots) {
  const nome = s.professional_name;
  if (!porProfissional.has(nome)) porProfissional.set(nome, []);
  porProfissional.get(nome).push(String(s.slot_time).slice(0, 5));
}

function formatarDataBR(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['domingo','segunda-feira','terca-feira','quarta-feira','quinta-feira','sexta-feira','sabado'];
  return `${dias[dt.getDay()]}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
}

const linhas = [];
for (const [nome, horas] of porProfissional.entries()) {
  if (horas.length === 0) continue;
  linhas.push(`${nome}: ${horas.slice(0, 8).join(', ')}`);
}

let toolResultStr;
if (linhas.length === 0) {
  toolResultStr = `Sem horarios disponiveis para ${formatarDataBR(toolCtx.dataAlvo)}${toolCtx.periodoAlvo ? ' no periodo da ' + toolCtx.periodoAlvo : ''}. Sugira outro dia ao paciente.`;
} else {
  toolResultStr =
    `Horarios disponiveis para ${formatarDataBR(toolCtx.dataAlvo)}` +
    `${toolCtx.periodoAlvo ? ' (' + toolCtx.periodoAlvo + ')' : ''}:\n` +
    linhas.join('\n');
}

// Montar novo body pro Claude
const messagesComTool = [
  ...toolCtx.messagesForClaude,
  { role: 'assistant', content: toolCtx.claudeContentBlocks },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolCtx.toolUseId, content: toolResultStr }] }
];

const claudeBodyComTool = JSON.stringify({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  system: toolCtx.systemPrompt,
  messages: messagesComTool
});

return [{
  claudeBodyComTool,
  phone: toolCtx.phone,
  userText: toolCtx.userText,
  customerName: toolCtx.customerName,
  convId: toolCtx.convId,
  isNewConversation: toolCtx.isNewConversation,
  messagesForClaude: toolCtx.messagesForClaude,
  systemPrompt: toolCtx.systemPrompt,
  supabasePatchUrl: toolCtx.supabasePatchUrl,
  supabasePostUrl: toolCtx.supabasePostUrl,
  _dataAlvo: toolCtx.dataAlvo,
  _periodoAlvo: toolCtx.periodoAlvo,
  _totalSlots: slots.length,
  _slotsResposta: toolResultStr
}];
```

---

## 6. Atualizar o system prompt da Donna

**Remover** qualquer menção a horários fixos hardcoded (tipo "Dra. Amanda atende de 9h às 19h"),
porque agora a verdade vem sempre da RPC. Manter só:

> `consultar_agenda(periodo)` — consulta a agenda e retorna os horários
> realmente disponíveis das profissionais. Use sempre que o paciente pedir
> horário, disponibilidade, ou quiser agendar.

---

## 7. Fluxo de teste rápido

1. Acesse `/dashboard/equipe`, configure horários da Dra. Sarah e Dra. Amanda.
2. Vá em `/dashboard/agenda/novo`, selecione profissional + data: o painel de
   "Horários disponíveis" deve aparecer com chips clicáveis.
3. Teste via SQL direto:
   ```sql
   SELECT * FROM get_available_slots(
     '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
     '2026-05-15'::date
   );
   ```
4. Teste via curl (simulando N8N):
   ```bash
   curl -X POST 'https://yqrjbyaucimvmzpfipgs.supabase.co/rest/v1/rpc/get_available_slots' \
     -H "apikey: SERVICE_KEY" \
     -H "Authorization: Bearer SERVICE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"p_clinic_id":"6a718c1d-9a79-4e80-ad71-1c5c8a2ea190","p_date":"2026-05-15"}'
   ```
5. Envie uma mensagem via WhatsApp: *"oi, tem horário amanhã à tarde?"*

---

## 8. Vantagens vs. versão hardcode

| Critério | Hardcode (v1) | RPC (v2) |
|----------|--------------|----------|
| Fonte da verdade | Duplicado (prompt + JS) | Banco (`professional_schedules`) |
| Atualizar horário | Editar N8N + prompt | Tela `/dashboard/equipe` |
| Respeita férias/folgas | Não | Sim (`professional_unavailability`) |
| Dashboard e Donna coerentes | Podem divergir | Mesma função SQL |
| Escala pra N profissionais | Precisa editar código | Automático |
| Horário específico por dia | Precisa editar código | Tela por profissional |

---

## 9. Próximos passos sugeridos (não-bloqueantes)

- Adicionar parâmetro `p_procedure_id` à RPC pra pegar `duration_minutes`
  direto de `procedures`, em vez de mandar duração fixa.
- Criar função `get_next_available_slot(clinic_id, professional_id)` —
  retorna só o próximo slot livre de forma otimizada.
- Adicionar tool `criar_agendamento(patient_phone, professional_id, datetime)`
  pra Donna *de fato* agendar no banco após confirmação do paciente.
