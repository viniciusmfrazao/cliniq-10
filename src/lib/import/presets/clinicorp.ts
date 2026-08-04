import type { ImportPreset } from '../types'

/**
 * Preset Clinicorp.
 *
 * Mapeia TODAS as colunas conhecidas do export, inclusive as que vieram
 * 100% nulas na amostra da Dra. Nathalia (email, endereço, CPF, sexo...).
 * Se outra clínica exportar esses campos preenchidos, eles são consumidos
 * automaticamente — sem alteração de código.
 *
 * Notas de modelagem apuradas na amostra:
 * - BookEntry é partida dobrada (CREDIT + DEBIT do mesmo fato). NÃO alimenta
 *   receita: usar PaymentHeader + PaymentItem. Só entra para despesas manuais.
 * - O CPF do paciente vem em OtherDocumentId; DocumentId guarda RG.
 * - TreatmentId (PaymentHeader) == BudgetId (Budgets).
 * - Procedures pode conter vários procedimentos separados por " / ".
 */
export const clinicorpPreset: ImportPreset = {
  id: 'clinicorp',
  label: 'Clinicorp',

  files: [
    {
      key: 'Patient',
      label: 'Pacientes',
      matchNames: ['patient'],
      signatureColumns: ['Name', 'MobilePhone', 'Type'],
      feeds: ['patients'],
    },
    {
      key: 'Dentist',
      label: 'Profissionais',
      matchNames: ['dentist'],
      signatureColumns: ['Name', 'Type'],
      feeds: [],
    },
    {
      key: 'Appointment',
      label: 'Agendamentos',
      matchNames: ['appointment'],
      signatureColumns: ['date', 'fromTime', 'PatientId'],
      feeds: ['appointments', 'procedures'],
    },
    {
      key: 'Budgets',
      label: 'Orçamentos',
      matchNames: ['budget'],
      signatureColumns: ['BudgetId', 'ProcedureName'],
      feeds: ['orcamentos', 'procedures'],
    },
    {
      key: 'PaymentHeader',
      label: 'Pagamentos',
      matchNames: ['paymentheader'],
      signatureColumns: ['PaymentDate', 'PatientId'],
      feeds: ['entradas'],
    },
    {
      key: 'PaymentItem',
      label: 'Parcelas',
      matchNames: ['paymentitem'],
      signatureColumns: ['PaymentHeaderId', 'Amount'],
      feeds: ['entradas'],
    },
    {
      key: 'BookEntry',
      label: 'Lançamentos (partida dobrada)',
      matchNames: ['bookentry'],
      signatureColumns: ['EntryType', 'Amount'],
      feeds: [],
    },
    {
      key: 'Anamnesis',
      label: 'Anamnese — modelos',
      matchNames: ['anamnesis'],
      // 'anamnesis' é prefixo de 'anamnesisquestions': a engine resolve pelo
      // match mais longo, então a ordem aqui não importa.
      signatureColumns: [],
      feeds: ['anamneses'],
      pending: true,
      pendingReason: 'Sem amostra com dados: arquivo veio sem linhas e sem cabeçalho.',
    },
    {
      key: 'AnamnesisQuestions',
      label: 'Anamnese — perguntas',
      matchNames: ['anamnesisquestions'],
      signatureColumns: [],
      feeds: ['anamneses'],
      pending: true,
      pendingReason: 'Sem amostra com dados: arquivo veio sem linhas e sem cabeçalho.',
    },
    {
      key: 'PatientAnamnesis',
      label: 'Anamnese — respostas',
      matchNames: ['patientanamnesis'],
      signatureColumns: [],
      feeds: ['anamneses'],
      pending: true,
      pendingReason: 'Sem amostra com dados: arquivo veio sem linhas e sem cabeçalho.',
    },
  ],

  fields: {
    patients: [
      { target: 'name', label: 'Nome', candidates: ['Name', 'PatientName', 'Nome'], transform: 'text', required: true },
      { target: 'phone', label: 'Telefone', candidates: ['MobilePhone', 'Phone', 'Celular'], transform: 'phone' },
      { target: 'email', label: 'E-mail', candidates: ['Email', 'E-mail'], transform: 'text' },
      { target: 'cpf', label: 'CPF', candidates: ['OtherDocumentId', 'CPF'], transform: 'cpf' },
      { target: 'birth_date', label: 'Nascimento', candidates: ['BirthDate', 'DataNascimento'], transform: 'date' },
      { target: 'gender', label: 'Sexo', candidates: ['Sex', 'Gender', 'Sexo'], transform: 'gender' },
      { target: 'address', label: 'Endereço', candidates: ['Address', 'Endereco'], transform: 'text' },
      { target: 'address_number', label: 'Número', candidates: ['AddressNumber', 'Numero'], transform: 'text' },
      { target: 'neighborhood', label: 'Bairro', candidates: ['Neighborhood', 'Bairro'], transform: 'text' },
      { target: 'city', label: 'Cidade', candidates: ['City', 'Cidade'], transform: 'text' },
      { target: 'state', label: 'Estado', candidates: ['state', 'State', 'UF'], transform: 'text' },
      { target: 'zip_code', label: 'CEP', candidates: ['Zip', 'ZipCode', 'CEP'], transform: 'text' },
      { target: 'created_at', label: 'Cadastrado em', candidates: ['InsertDate', 'CreateDate'], transform: 'datetime' },
    ],

    appointments: [
      { target: 'start_time', label: 'Data', candidates: ['date', 'Date'], transform: 'text', required: true },
      { target: 'notes', label: 'Observações', candidates: ['Notes', 'Observacoes'], transform: 'text' },
    ],

    orcamentos: [
      { target: 'titulo', label: 'Procedimento', candidates: ['ProcedureName'], transform: 'text', required: true },
      { target: 'valor', label: 'Valor final', candidates: ['ProcedureFinalAmount', 'ProcedureAmount'], transform: 'number' },
      { target: 'created_at', label: 'Criado em', candidates: ['BudgetsCreateDate'], transform: 'datetime' },
      { target: 'observacoes', label: 'Observações', candidates: ['BudgetsNotes', 'Notes'], transform: 'text' },
    ],

    entradas: [
      { target: 'data_venda', label: 'Data', candidates: ['PaymentDate', 'Date'], transform: 'date', required: true },
      { target: 'observacoes', label: 'Descrição', candidates: ['Description', 'PaymentDescription'], transform: 'text' },
    ],
  },

  valueMaps: {
    paymentForm: {
      PIX_EXTERNAL: 'pix',
      PIX: 'pix',
      CREDIT_CARD_EXTERNAL: 'credito',
      CREDIT_CARD: 'credito',
      DEBIT_CARD_EXTERNAL: 'debito',
      DEBIT_CARD: 'debito',
      BOLETO_EXTERNAL: 'boleto',
      BOLETO: 'boleto',
      MONEY: 'dinheiro',
      CASH: 'dinheiro',
      Dinheiro: 'dinheiro',
      Pix: 'pix',
      Boleto: 'boleto',
      OTHER: 'outro',
    },
    gender: { F: 'feminino', M: 'masculino' },
  },
}

export const PRESETS = { clinicorp: clinicorpPreset }
export type PresetId = keyof typeof PRESETS
