# 🚀 Melhorias Inovadoras — Cliniq

> Criado em 28/04/2026 — depois do sistema base estar rodando estável.
>
> Foco: features com **IA embutida** que viram diferencial competitivo (demos vendem) ou ROI direto (retenção/conversão).
>
> Cada item tem: o que é, como funciona, esforço estimado, ROI/impacto, tech stack sugerido.

---

## 📊 Resumo executivo (priorizado)

| # | Feature | Categoria | Esforço | ROI | Demo? |
|---|---|---|---|---|---|
| 1 | **Simulador estético com IA (antes/depois)** | Marketing/Demo | 2-3 sessões | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 2 | **Análise de pele com IA** | Clinical | 2 sessões | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 3 | **Resumo automático de prontuário** | Operação | 1 sessão | 🔥🔥 | ⭐⭐⭐ |
| 4 | **Predição de no-show** | Operação | 2 sessões | 🔥🔥🔥 | ⭐⭐ |
| 5 | **Lead scoring na Donna** | CRM/Donna | 1 sessão | 🔥🔥 | ⭐⭐ |
| 6 | **Voice-to-text estruturado na evolução** | Operação | 1-2 sessões | 🔥🔥 | ⭐⭐⭐⭐ |
| 7 | **Comparativo automático antes/depois** | Clinical/Marketing | 1 sessão | 🔥🔥 | ⭐⭐⭐⭐ |
| 8 | **Geração de posts pro Instagram** | Marketing | 1-2 sessões | 🔥🔥 | ⭐⭐⭐⭐ |
| 9 | **Pre-anamnese conversacional via Donna** | Atendimento | 1 sessão | 🔥🔥 | ⭐⭐⭐ |
| 10 | **Análise de sentimento WhatsApp** | Retenção | 1 sessão | 🔥🔥 | ⭐⭐ |
| 11 | **Recomendação de procedimentos (upsell)** | Marketing | 1 sessão | 🔥🔥🔥 | ⭐⭐⭐ |
| 12 | **Risk-scoring de contraindicações** | Clinical | 2 sessões | 🔥🔥 | ⭐⭐⭐ |
| 13 | **Reconhecimento facial pra check-in** | Operação | 2-3 sessões | 🔥 | ⭐⭐⭐⭐⭐ |

> Esforço: cada "sessão" ≈ 4-6 horas focadas.
> ROI: 🔥 baixo / 🔥🔥 médio / 🔥🔥🔥 alto.
> Demo: quão impressionante na demonstração comercial.

---

## 🎨 CATEGORIA 1 — Visualmente impressionantes (vendem demo)

### 1. Simulador estético com IA (antes/depois)

> O que você pediu: "foto do paciente + IA mostra como fica depois do botox/preenchedor".

**O que é:** o paciente (ou a Sarah na consulta) tira foto, escolhe o procedimento (botox testa, preenchedor labial, harmonização, lifting), e a IA gera uma simulação realista do "depois" em 5-10 segundos.

**Como funciona:**
1. Upload de foto frontal do paciente
2. Detecção de landmarks faciais (FaceLandmarker / MediaPipe)
3. Aplicação do efeito via modelo image-to-image (Replicate, Stable Diffusion + ControlNet, ou modelos especializados como GFPGAN + IP-Adapter)
4. Apresentação **slider lado a lado** (antes/depois)
5. Salvar no prontuário do paciente como anexo

**Procedimentos cobertos (priorizados):**
- Botox em rugas frontais (testa, glabela, periorbicular)
- Preenchimento labial
- Preenchimento malar (maçã do rosto)
- Bichectomia (efeito remoção bola de Bichat)
- Harmonização facial completa

**Tech stack:**
- Frontend: Canvas + slider before/after (já tem libs prontas)
- Backend: Edge function que chama Replicate API (modelos `idm-vton`, `instantid`, ou custom LoRA treinada com fotos antes/depois)
- Storage: Supabase Storage (`patient-simulations` bucket)
- Custo Replicate: ~$0,01-0,05 por simulação

**Esforço:** 2-3 sessões.

**ROI:** ALTÍSSIMO — paciente vê resultado, fecha procedimento. Dra. Sarah pode vender pacote inteiro mostrando antes-depois ali na hora.

**Risco:** simulação não-clínica precisa de **disclaimer obrigatório**: "simulação ilustrativa, resultado real pode variar". Tem que estar bem visível.

---

### 2. Análise de pele com IA

**O que é:** paciente tira foto do rosto, IA analisa e devolve diagnóstico estruturado:
- Pontos de oleosidade
- Manchas (com mapa de calor)
- Rugas finas vs profundas
- Hidratação aparente
- Idade aparente vs idade real
- **Recomendação automática de procedimentos**

**Como funciona:**
1. Foto de alta resolução (com luz da clínica padronizada)
2. Modelo de visão (GPT-4o, Claude 3.5 Sonnet ou Gemini 2.0 com prompt estruturado) analisa e retorna JSON
3. Frontend renderiza overlay sobre a foto + score por dimensão
4. Sugere procedimentos da clínica que tratam cada problema (já tem `procedures` cadastrados)

**Tech stack:**
- Anthropic Claude 3.5 Sonnet vision (custo ~$0.003 por análise)
- Output: JSON com `oleosidade: 7/10`, `manchas: [{coords, severidade}]`, `recomendacoes: [{procedure_id, motivo}]`

**Esforço:** 2 sessões.

**ROI:** ALTO — vira ponto de **upsell automático**. Toda 1ª consulta gera análise + 2-4 sugestões de procedimentos.

**Bonus:** evolução da pele ao longo do tempo. Mês 1 vs mês 6 da Sarah Pina = relatório visual lindo pro paciente.

---

### 7. Comparativo automático antes/depois

**O que é:** quando o paciente chega pra retorno, sistema **alinha automaticamente** as 2 fotos (antes e depois) corrigindo posição/iluminação, e gera comparativo lado-a-lado pronto pra paciente compartilhar.

**Como funciona:**
1. Detecta landmarks faciais nas 2 fotos
2. Alinha via affine transform
3. Equaliza luz e cor
4. Gera imagem composta (pode ser slider ou split)
5. Adiciona watermark da clínica + data

**Tech stack:**
- OpenCV.js no browser (gratuito, processa local)
- Pode rodar 100% client-side, zero custo de API

**Esforço:** 1 sessão.

**ROI:** MÉDIO — facilita criação de conteúdo pro Instagram da clínica + paciente compartilha sozinho.

---

### 8. Geração de posts pro Instagram

**O que é:** Sarah marca um caso de sucesso → IA gera 3 sugestões de **post Instagram** (caption + hashtags + sugestão de imagem) usando antes/depois.

**Como funciona:**
1. Sarah seleciona paciente + procedimento + foto antes/depois
2. IA gera:
   - 3 caption variations (formal/descontraída/com storytelling)
   - Hashtags relevantes (#harmonizacaofacial #botox #drasarapina)
   - Sugestão de música/áudio pro Reels
3. Botão "publicar" via Meta Graph API (ou copy-paste manual)

**Tech stack:**
- Claude 3.5 Sonnet pra texto
- Meta Graph API (precisa cadastro Instagram Business)

**Esforço:** 1-2 sessões.

**ROI:** MÉDIO — economiza 30min de marketing por post.

---

### 13. Reconhecimento facial pra check-in

**O que é:** câmera na recepção, paciente chega, sistema reconhece pela face e dá check-in automático (`appointments.checked_in_at`).

**Como funciona:**
1. Cadastra embedding facial de cada paciente na 1ª consulta (com consentimento LGPD)
2. Tablet/câmera na recepção monitora rostos
3. Match com embedding (cosine similarity > 0.7) → marca check-in + abre prontuário pra Sarah
4. Sem match → workflow manual de cadastro

**Tech stack:**
- Face-api.js (browser) ou AWS Rekognition
- Storage de embeddings: nova tabela `patient_face_embeddings` (vector(128))
- pgvector no Supabase (já vem ligado)

**Esforço:** 2-3 sessões.

**ROI:** BAIXO (Sarah ainda não tem demanda alta de fila), mas **DEMO mata** investidor/franqueado. "Cliente entra, é reconhecido, prontuário abre na tela do médico."

---

## ⚙️ CATEGORIA 2 — Operação clínica (eficiência diária)

### 3. Resumo automático de prontuário

**O que é:** IA lê todas as evoluções/anamneses do paciente e gera **resumo de 3 bullets** no topo do prontuário.

**Exemplo:**
> 📋 **Resumo do paciente** (atualizado automaticamente)
> - 📅 Cliente desde 03/2024 (8 procedimentos: 3 botox, 2 preenchimento, 3 limpeza)
> - ⚠️ Alergia a lidocaína. Histórico de herpes labial — pré-medicação obrigatória.
> - 💡 Última fala em conversa: "queria mexer no contorno". Sugestão: avaliar mandíbula no próximo retorno.

**Como funciona:**
- Quando médico abre prontuário, edge function chama Claude com:
  - Todas as `evolutions` (últimas 12 meses)
  - Todas as `anamneses`
  - Últimas 10 mensagens WhatsApp do paciente
- Cache de 24h por paciente (não regera a cada visualização)

**Tech stack:**
- Claude 3.5 Sonnet (~$0.005 por resumo, com cache 24h)
- Coluna nova `patients.ai_summary text` + `ai_summary_at timestamptz`

**Esforço:** 1 sessão.

**ROI:** ALTÍSSIMO — Sarah ganha 5min por consulta. 20 consultas/dia = 1h40 de produtividade extra.

---

### 6. Voice-to-text estruturado na evolução

**O que é:** durante o procedimento, Sarah grava áudio livremente ("hoje fiz botox na testa, 16U, paciente reclamou de dor leve, evolução boa") → IA transcreve E **estrutura** em campos (procedimento, dosagem, observação, plano).

**Como funciona:**
1. Botão "🎙️ Gravar evolução" na tela de atendimento
2. Whisper API transcreve
3. Claude estrutura em JSON:
   ```json
   {
     "procedure_done": "Botox testa",
     "dosage": "16U Botulax",
     "patient_complaints": "Dor leve durante aplicação",
     "next_steps": "Retorno em 15 dias",
     "free_text": "<transcrição completa>"
   }
   ```
4. Pré-preenche o formulário de evolução (médico só revisa e aprova)

**Tech stack:**
- Whisper API (OpenAI) — $0.006/min
- Claude pra estruturação — $0.003/chamada

**Esforço:** 1-2 sessões.

**ROI:** ALTÍSSIMO. Sarah faz evolução em 30s em vez de 3min.

---

### 9. Pre-anamnese conversacional via Donna

**O que é:** depois do paciente agendar (M2 do roadmap Donna), Donna **conversa naturalmente** no WhatsApp pra coletar a anamnese — em vez de mandar um formulário enorme.

**Exemplo:**
> Donna: "Beleza, agendado pra terça! Posso fazer 4 perguntinhas rápidas pro Dr ter teu histórico antes?"
> Paciente: "pode"
> Donna: "Você tem alguma alergia a anestésico ou medicamento?"
> Paciente: "nada que eu saiba"
> Donna: "Faz uso contínuo de algum remédio?"
> ...
> Donna: "Show! Anotei tudo. Te vejo terça 💜"

**Como funciona:**
- Variante do flow atual da Donna, mas com state machine de "modo anamnese"
- Cada resposta é mapeada pro `responses` da `anamneses`
- Ao final, cria `anamneses` com `status='completed'` e `completed_at = now()`

**Tech stack:**
- Já tem Donna (Claude) rodando — só estender o prompt
- Conexão direta com `anamneses` table (já existe)

**Esforço:** 1 sessão (depois que o M2 da Donna estiver pronto).

**ROI:** MÉDIO-ALTO. Conversão de anamnese sobe muito (paciente prefere conversa a formulário).

---

### 12. Risk-scoring de contraindicações

**O que é:** quando médica vai prescrever procedimento, IA cruza com anamnese do paciente e **alerta automaticamente** sobre contraindicações.

**Exemplo:**
> 🚨 **Atenção!** Paciente tem histórico de herpes labial (anamnese 03/2025). Recomendado pré-medicação com aciclovir 24h antes de preenchimento labial.
>
> ⚠️ Paciente está amamentando (anamnese 04/2026). Algumas substâncias contraindicadas.

**Como funciona:**
- Edge function consulta `anamneses` + `procedures` selecionado
- Claude com prompt estruturado retorna alertas
- Aparece no momento de fechar atendimento

**Tech stack:**
- Claude 3.5 Sonnet
- Conhecimento médico-clínico no prompt (compilado da OMS, ANVISA)

**Esforço:** 2 sessões (precisa validação clínica do prompt).

**ROI:** ALTO em segurança jurídica. Reduz riscos legais.

---

## 📈 CATEGORIA 3 — Inteligência de negócio (predição/analytics)

### 4. Predição de no-show

**O que é:** IA prevê **quem vai faltar** na consulta de amanhã com X% de certeza.

**Features pra modelo:**
- Histórico de no-shows do paciente
- Tempo entre agendamento e consulta
- Dia da semana e horário
- Confirmou D-1?
- Última mensagem WhatsApp foi há quanto tempo?
- Procedimento (consultas mais "compromissadas" tem menos no-show)
- Distância do CEP do paciente até clínica

**Saída:**
- Score 0-100 de probabilidade de no-show
- Top 3 razões prováveis
- Sugestão: "ligar 30min antes" / "overbooking esse slot"

**Tech stack:**
- XGBoost ou Random Forest treinado em histórico de `appointments`
- API Python (Vercel ou Modal) ou rodar via Supabase Edge Function
- Cache de score por appointment (atualiza 1×/h até a consulta)

**Esforço:** 2 sessões (uma pra modelo, uma pra UI).

**ROI:** ALTÍSSIMO. Cada no-show custa 1 slot ocioso + 1 cliente perdido. Reduzir 30% dos no-shows = receita extra.

---

### 5. Lead scoring na Donna

**O que é:** depois de cada conversa Donna ↔ lead, IA pontua o lead em 3 dimensões:
- **Intenção de compra** (0-10)
- **Capacidade financeira aparente** (0-10)
- **Urgência** (0-10)

CRM filtra "leads quentes" automaticamente pra Sarah/secretária priorizar.

**Como funciona:**
- Após cada mensagem, edge function chama Claude
- Claude analisa últimas 10 mensagens da conversa
- Atualiza colunas `leads.ai_score`, `leads.ai_priority`, `leads.ai_sentiment` (já existem!)

**Tech stack:**
- Claude 3.5 Sonnet
- Colunas já existem no schema ✅

**Esforço:** 1 sessão.

**ROI:** MÉDIO-ALTO — secretária pula leads frios e ataca os quentes.

---

### 10. Análise de sentimento WhatsApp

**O que é:** monitora todas as conversas e **detecta clientes insatisfeitos** antes deles cancelarem ou darem reclamação.

**Sinais:**
- Tempo de resposta crescente
- Tom negativo (Claude pontua sentimento)
- Palavras-chave: "não gostei", "não senti efeito", "cobrança errada"
- Drop de frequência de visita pós-procedimento

**Saída:**
- Dashboard "🚨 Pacientes em risco" — lista os top 10 que precisam de atenção
- Notificação automática pra Sarah quando alguém entra na lista

**Tech stack:**
- Cron 1×/dia roda análise das últimas 7 dias de conversas
- Claude classifica + score
- Nova tabela `patient_risk_log`

**Esforço:** 1 sessão.

**ROI:** ALTO em retenção. Sarah liga **antes** do paciente reclamar publicamente.

---

### 11. Recomendação de procedimentos (upsell)

**O que é:** baseado em histórico do paciente, IA sugere "próximo passo" lógico.

**Exemplo:**
- Fez botox testa há 3 meses → sugere manutenção (em 30 dias)
- Faz limpeza de pele mensal → ofertar pacote anual
- Já fez 2 preenchimentos labiais → cross-sell em harmonização malar

**Como funciona:**
- Análise de `appointments` + `procedures` do paciente
- Modelo de recomendação tipo "people who did X also did Y"
- Mais simples: regras de negócio + Claude pra texto da sugestão

**Saída:**
- No prontuário: "💡 Sugestões pra próxima consulta" com 2-3 itens
- Link "agendar" + texto pronto pra mandar no WhatsApp

**Tech stack:**
- Query SQL + Claude pra mensagem personalizada

**Esforço:** 1 sessão.

**ROI:** ALTÍSSIMO em ticket médio.

---

## 🛠️ Caminho recomendado de execução

### Sprint A — quick wins de demo (vende cliente novo / franquia)

```
1. Resumo automático de prontuário (1 sessão) — Sarah vê valor IMEDIATO
2. Análise de pele com IA (2 sessões) — efeito WOW na 1ª consulta
3. Voice-to-text estruturado (1-2 sessões) — economiza 1h40/dia
```

### Sprint B — receita direta

```
4. Recomendação de procedimentos (1 sessão) — upsell automático
5. Predição de no-show (2 sessões) — receita resgatada
6. Simulador estético (2-3 sessões) — fecha venda na hora ⭐
```

### Sprint C — Donna inteligente (depois do M1-M5 da ROADMAP-DONNA.md)

```
7. Lead scoring (1 sessão) — prioriza leads quentes
8. Pre-anamnese conversacional (1 sessão)
9. Análise de sentimento WhatsApp (1 sessão)
```

### Sprint D — diferencial premium

```
10. Comparativo automático antes/depois (1 sessão)
11. Geração de posts Instagram (1-2 sessões)
12. Risk-scoring de contraindicações (2 sessões)
13. Reconhecimento facial pra check-in (2-3 sessões) — só quando tiver fila
```

---

## 💰 Estimativa de custo de IA por mês

Para 100 pacientes ativos / 500 atendimentos / mês:

| Feature | Volume | Custo/mês |
|---|---|---|
| Resumo prontuário | 500 calls | ~$2,50 |
| Análise pele | 100 calls | ~$0,30 |
| Voice-to-text | 500min | ~$3,00 |
| Lead scoring | 1000 calls | ~$3,00 |
| Recomendação | 500 calls | ~$1,50 |
| **Subtotal recorrente** | | **~$10/mês** |
| Simulador estético (Replicate) | 50 simulações | ~$2,50 |
| **Total inicial** | | **~$12,50/mês** |

> Comparado ao ticket médio de procedimentos estéticos, essas features se pagam em **1 cliente convertido a mais por mês**.

---

## 🔐 Considerações de privacidade (LGPD)

Toda feature com IA tem que:

1. **Consentimento explícito** do paciente pra processamento por IA
2. **Não enviar PII desnecessária** (CPF, endereço) pros LLMs
3. **Logs de auditoria** de cada call de IA (já temos `audit_log`)
4. **Right to be forgotten** — embeddings/imagens deletados quando paciente solicita
5. **Modelo "no-train"** — usar APIs com flag de não-treinamento (Anthropic + OpenAI Enterprise)

Adicionar termo de uso de IA no termo de consentimento da clínica (ja existe modelo).

---

## 🎯 Decisão recomendada

Se eu pudesse escolher por você, começaria com:

1. **Resumo de prontuário** (1 sessão) — Sarah usa amanhã
2. **Voice-to-text estruturado** (1-2 sessões) — Sarah usa em todo atendimento
3. **Análise de pele** (2 sessões) — vira diferencial na primeira consulta
4. **Simulador estético** (2-3 sessões) — vira **storytelling de venda** ⭐

Total: ~7 sessões pra um produto que sai do "sistema de gestão" e vira **plataforma com IA embutida** — mudou de categoria.

> Conversa pra valer com a Sarah qual ela acharia mais útil pro dia a dia, e qual venderia franquias. Aí prioriza esse top 4.
