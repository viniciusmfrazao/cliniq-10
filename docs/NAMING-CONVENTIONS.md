# Convenções de Nomenclatura

## Situação Atual

O projeto usa **nomenclatura mista PT/EN** por razões históricas. 
**NÃO alterar tabelas/colunas existentes** - risco de quebrar o sistema.

---

## Glossário: Mapeamento PT ↔ EN

### Tabelas

| Português | Inglês | Usado no Projeto |
|-----------|--------|------------------|
| entradas | incomes / revenues | `entradas` ✅ |
| saidas | expenses / outcomes | `saidas` ✅ |
| debitos | debts | `debitos` ✅ |
| metas_financeiras | financial_goals | `metas_financeiras` ✅ |
| pacientes | patients | `patients` ✅ |
| agendamentos | appointments | `appointments` ✅ |
| procedimentos | procedures | `procedures` ✅ |
| usuarios | users | `users` ✅ |
| clinicas | clinics | `clinics` ✅ |
| salas | rooms | `rooms` ✅ |
| produtos | products | `products` ✅ |
| evolucoes | evolutions | `evolutions` ✅ |
| prontuario | medical_records | `medical_records` ✅ |
| lista_espera | waiting_list | `waiting_list` ✅ |
| notificacoes | notifications | `notifications` ✅ |
| documentos | documents | `documents_sent` ✅ |
| anamnese | anamnesis | `anamneses` ✅ |

### Colunas Comuns

| Português | Inglês | Padrão Adotado |
|-----------|--------|----------------|
| id | id | `id` ✅ |
| clinica_id | clinic_id | `clinic_id` ✅ |
| paciente_id | patient_id | **MISTO** ⚠️ |
| profissional_id | professional_id | **MISTO** ⚠️ |
| procedimento_id | procedure_id | **MISTO** ⚠️ |
| data_criacao | created_at | `created_at` ✅ |
| data_atualizacao | updated_at | `updated_at` ✅ |
| ativo | active | `active` ✅ |
| nome | name | `name` ✅ |
| descricao | description | `description` ✅ |
| valor | value / price | `valor` ou `price` ⚠️ |
| data | date | `data` ou `date` ⚠️ |
| observacoes | notes | `notes` ou `observacoes` ⚠️ |

---

## Regras para NOVO Código

### 1. Tabelas Novas → INGLÊS
```sql
-- ✅ Correto
CREATE TABLE payment_methods (...)
CREATE TABLE appointment_reminders (...)

-- ❌ Evitar
CREATE TABLE formas_pagamento (...)
CREATE TABLE lembretes_agendamento (...)
```

### 2. Colunas Novas → INGLÊS
```sql
-- ✅ Correto
ALTER TABLE patients ADD COLUMN last_visit_at timestamptz;

-- ❌ Evitar
ALTER TABLE patients ADD COLUMN ultima_visita timestamptz;
```

### 3. Foreign Keys → Padrão `{tabela}_id`
```sql
-- ✅ Correto (tabela em inglês)
patient_id, clinic_id, user_id, procedure_id

-- ⚠️ Existente (manter por compatibilidade)
paciente_id, profissional_id, procedimento_id
```

### 4. Timestamps → Padrão `{ação}_at`
```sql
-- ✅ Correto
created_at, updated_at, deleted_at, signed_at, viewed_at

-- ❌ Evitar
data_criacao, data_atualizacao
```

### 5. Booleanos → Padrão `is_{adjetivo}` ou `{adjetivo}`
```sql
-- ✅ Correto
active, is_active, is_promotion, is_verified

-- ❌ Evitar
ativo, promocao, verificado
```

---

## Tabelas com Nomenclatura Mista (Manter)

### `entradas` (Financeiro - Receitas)
```sql
-- Colunas em PT (manter por compatibilidade)
data_venda        -- data da venda
paciente_id       -- FK para patients (sim, misto)
paciente_nome     -- snapshot do nome
procedimento_id   -- FK para procedures
procedimento_nome -- snapshot do nome
profissional_id   -- FK para users
profissional_nome -- snapshot do nome
forma_pagamento   -- método de pagamento
valor_bruto       -- valor total
valor_liquido     -- valor após taxas
taxa_percentual   -- % de taxa
n_parcelas        -- número de parcelas
observacoes       -- notas
```

### `saidas` (Financeiro - Despesas)
```sql
-- Colunas em PT (manter por compatibilidade)
data              -- data da despesa
descricao         -- descrição
categoria_dre     -- categoria do DRE
fornecedor        -- fornecedor
valor             -- valor
forma_pagamento   -- método
observacoes       -- notas
```

### `debitos` (Débitos de Pacientes)
```sql
-- Colunas em PT (manter por compatibilidade)
paciente_id       -- FK
valor             -- valor do débito
descricao         -- descrição
data_vencimento   -- data de vencimento
data_pagamento    -- quando foi pago
```

---

## No Código TypeScript

### Usar nomes em inglês para variáveis
```typescript
// ✅ Correto
const patients = await getPatients(...)
const appointments = await getAppointments(...)
const revenue = entrada.valor_bruto  // campo PT, variável EN

// ❌ Evitar
const pacientes = await getPatients(...)
const entradas = await getEntradas(...)
```

### Interfaces seguem o banco
```typescript
// Interface reflete o banco (mesmo que misto)
interface Entrada {
  id: string
  clinic_id: string      // EN
  paciente_id: string    // PT
  valor_bruto: number    // PT
  created_at: string     // EN
}
```

---

## Resumo

| Situação | Ação |
|----------|------|
| Tabelas existentes | **NÃO MUDAR** |
| Colunas existentes | **NÃO MUDAR** |
| Tabelas novas | Usar INGLÊS |
| Colunas novas | Usar INGLÊS |
| Variáveis no código | Usar INGLÊS |
| Interfaces TypeScript | Refletir o banco |

---

## Por que não migrar?

1. **Risco de quebra** - Centenas de queries precisariam ser atualizadas
2. **Downtime** - Migrations de rename são perigosas
3. **Custo/Benefício** - Não melhora funcionalidade, só estética
4. **Histórico** - Relatórios antigos podem quebrar

A convenção mista funciona bem desde que seja **documentada e consistente para código novo**.
