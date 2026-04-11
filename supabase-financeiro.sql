-- ============================================
-- MÓDULO FINANCEIRO - TABELAS
-- ============================================

-- Categorias DRE
CREATE TABLE IF NOT EXISTS categorias_dre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Formas de pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  taxa_percentual NUMERIC(5,2) DEFAULT 0,
  dias_recebimento INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entradas (receitas)
CREATE TABLE IF NOT EXISTS entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  data_venda DATE NOT NULL,
  paciente_id UUID REFERENCES patients(id),
  paciente_nome TEXT,
  procedimento_id UUID REFERENCES procedures(id),
  procedimento_nome TEXT,
  profissional_id UUID REFERENCES users(id),
  profissional_nome TEXT,
  forma_pagamento TEXT NOT NULL,
  bandeira TEXT,
  valor_bruto NUMERIC(10,2) NOT NULL,
  taxa_percentual NUMERIC(5,2) DEFAULT 0,
  valor_taxa NUMERIC(10,2) DEFAULT 0,
  valor_liquido NUMERIC(10,2) NOT NULL,
  n_parcelas INTEGER DEFAULT 1,
  observacoes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parcelas de entradas
CREATE TABLE IF NOT EXISTS parcelas_entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES entradas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Saídas (despesas)
CREATE TABLE IF NOT EXISTS saidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria_dre TEXT,
  fornecedor TEXT,
  valor NUMERIC(10,2) NOT NULL,
  forma_pagamento TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Metas financeiras
CREATE TABLE IF NOT EXISTS metas_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  meta_receita NUMERIC(10,2) NOT NULL,
  meta_atendimentos INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, mes)
);

-- View para Fluxo de Caixa
CREATE OR REPLACE VIEW vw_fluxo_caixa AS
SELECT 
  date_trunc('month', e.data_venda)::date as mes,
  e.clinic_id,
  SUM(e.valor_liquido) as total_entradas,
  COALESCE((
    SELECT SUM(s.valor) 
    FROM saidas s 
    WHERE date_trunc('month', s.data) = date_trunc('month', e.data_venda)
    AND s.clinic_id = e.clinic_id
  ), 0) as total_saidas,
  SUM(e.valor_liquido) - COALESCE((
    SELECT SUM(s.valor) 
    FROM saidas s 
    WHERE date_trunc('month', s.data) = date_trunc('month', e.data_venda)
    AND s.clinic_id = e.clinic_id
  ), 0) as resultado
FROM entradas e
GROUP BY date_trunc('month', e.data_venda), e.clinic_id
ORDER BY mes;

-- Inserir categorias DRE padrão (rodar após criar clínica)
-- INSERT INTO categorias_dre (clinic_id, nome, tipo, ordem) VALUES
-- ('SEU_CLINIC_ID', 'CMV / Insumos', 'despesa', 1),
-- ('SEU_CLINIC_ID', 'Despesas com Pessoal', 'despesa', 2),
-- ('SEU_CLINIC_ID', 'Despesas Administrativas', 'despesa', 3),
-- ('SEU_CLINIC_ID', 'Despesas com Vendas', 'despesa', 4),
-- ('SEU_CLINIC_ID', 'Impostos e Obrigações', 'despesa', 5),
-- ('SEU_CLINIC_ID', 'Despesas Financeiras', 'despesa', 6),
-- ('SEU_CLINIC_ID', 'Outros', 'despesa', 7);

-- Inserir formas de pagamento padrão
-- INSERT INTO formas_pagamento (clinic_id, nome, taxa_percentual, dias_recebimento) VALUES
-- ('SEU_CLINIC_ID', 'Pix', 0, 0),
-- ('SEU_CLINIC_ID', 'Dinheiro', 0, 0),
-- ('SEU_CLINIC_ID', 'Débito', 1.5, 1),
-- ('SEU_CLINIC_ID', 'Crédito 1x', 3.5, 30),
-- ('SEU_CLINIC_ID', 'Crédito 2x', 5.0, 30),
-- ('SEU_CLINIC_ID', 'Crédito 3x', 6.5, 30);

-- RLS
ALTER TABLE entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entradas_select" ON entradas FOR SELECT USING (clinic_id = get_my_clinic_id());
CREATE POLICY "entradas_insert" ON entradas FOR INSERT WITH CHECK (clinic_id = get_my_clinic_id());
CREATE POLICY "entradas_update" ON entradas FOR UPDATE USING (clinic_id = get_my_clinic_id());
CREATE POLICY "entradas_delete" ON entradas FOR DELETE USING (clinic_id = get_my_clinic_id());

CREATE POLICY "saidas_select" ON saidas FOR SELECT USING (clinic_id = get_my_clinic_id());
CREATE POLICY "saidas_insert" ON saidas FOR INSERT WITH CHECK (clinic_id = get_my_clinic_id());
CREATE POLICY "saidas_update" ON saidas FOR UPDATE USING (clinic_id = get_my_clinic_id());
CREATE POLICY "saidas_delete" ON saidas FOR DELETE USING (clinic_id = get_my_clinic_id());

CREATE POLICY "parcelas_select" ON parcelas_entradas FOR SELECT USING (
  entrada_id IN (SELECT id FROM entradas WHERE clinic_id = get_my_clinic_id())
);
CREATE POLICY "parcelas_insert" ON parcelas_entradas FOR INSERT WITH CHECK (
  entrada_id IN (SELECT id FROM entradas WHERE clinic_id = get_my_clinic_id())
);

CREATE POLICY "categorias_select" ON categorias_dre FOR SELECT USING (clinic_id = get_my_clinic_id());
CREATE POLICY "formas_select" ON formas_pagamento FOR SELECT USING (clinic_id = get_my_clinic_id());

ALTER TABLE metas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_select" ON metas_financeiras FOR SELECT USING (clinic_id = get_my_clinic_id());
CREATE POLICY "metas_insert" ON metas_financeiras FOR INSERT WITH CHECK (clinic_id = get_my_clinic_id());
CREATE POLICY "metas_update" ON metas_financeiras FOR UPDATE USING (clinic_id = get_my_clinic_id());
CREATE POLICY "metas_delete" ON metas_financeiras FOR DELETE USING (clinic_id = get_my_clinic_id());
