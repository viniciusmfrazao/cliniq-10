import type { ImportPreset } from '../types'

/**
 * Preset Experte (concorrente).
 *
 * Export em CSVs separados, cabeçalhos em português, sem coluna de ID
 * própria em pacientes (o cruzamento com agendamentos é feito pelo nome).
 *
 * Notas de modelagem apuradas na amostra (clínica Eleva, ago/2026):
 * - patients.csv não tem coluna id — o vínculo com consultations.csv é
 *   pelo nome (ID Paciente / Nome Paciente), então nomes duplicados em
 *   patients.csv colidem. Poucos casos na amostra, sinalizado como aviso.
 * - consultations.csv concatena múltiplos procedimentos por vírgula
 *   (ex.: "Drenagem manual,Hidrolipo"), diferente do Clinicorp que usa " / ".
 * - financial_titles.csv é o agregado por título; financial_parcels.csv
 *   já vem no nível de parcela com forma de pagamento — usamos parcels
 *   como fonte de entradas.
 * - "Saldo Inicial" (categoria Transferências) não é receita real.
 */
export const expertePreset: ImportPreset = {
  id: 'experte',
  label: 'Experte',

  files: [
    {
      key: 'Patients',
      label: 'Pacientes',
      matchNames: ['patients'],
      signatureColumns: ['Nome', 'Contato Celular'],
      feeds: ['patients'],
    },
    {
      key: 'Professionals',
      label: 'Profissionais',
      matchNames: ['professionals'],
      signatureColumns: ['Nome', 'Acesso'],
      feeds: [],
    },
    {
      key: 'ConsultationTypes',
      label: 'Procedimentos',
      matchNames: ['consultation_types', 'consultationtypes'],
      signatureColumns: ['Nome', 'Duração (minutos)'],
      feeds: ['procedures'],
    },
    {
      key: 'Consultations',
      label: 'Agendamentos',
      matchNames: ['consultations'],
      signatureColumns: ['Data', 'Horário início', 'ID Paciente'],
      feeds: ['appointments'],
    },
    {
      key: 'FinancialTitles',
      label: 'Financeiro — títulos',
      matchNames: ['financial_titles'],
      signatureColumns: ['Nome do contato', 'Valor bruto'],
      feeds: [],
    },
    {
      key: 'FinancialParcels',
      label: 'Financeiro — parcelas',
      matchNames: ['financial_parcels'],
      signatureColumns: ['Método de pagamento', 'Valor bruto'],
      feeds: ['entradas'],
    },
    {
      key: 'Providers',
      label: 'Fornecedores',
      matchNames: ['providers'],
      signatureColumns: [],
      feeds: [],
    },
  ],

  // Não usado pela engine do Experte (que lê as colunas em português
  // diretamente) — mantido só para satisfazer o tipo ImportPreset.
  fields: {},

  valueMaps: {
    paymentForm: {
      PIX: 'pix',
      Pix: 'pix',
      'Cartão de Crédito': 'credito',
      'Cartão de crédito': 'credito',
      Crédito: 'credito',
      'Cartão de Débito': 'debito',
      'Cartão de débito': 'debito',
      Débito: 'debito',
      Dinheiro: 'dinheiro',
      Espécie: 'dinheiro',
      Boleto: 'boleto',
      Depósito: 'outro',
      Transferência: 'outro',
    },
    gender: { Feminino: 'F', Masculino: 'M' },
  },
}

export const EXPERTE_PRESETS = { experte: expertePreset }
