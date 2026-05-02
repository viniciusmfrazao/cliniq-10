-- ============================================================================
-- Preenche os dados da clínica que a Eva usa nas conversas
--
-- Edite os 5 campos abaixo (address, phone, hours, instagram, observations)
-- com os dados reais da clínica e rode no SQL Editor do Supabase.
--
-- A Eva passa a:
--   - Mandar endereço/horário ao confirmar agendamento
--   - Responder perguntas tipo "qual o endereço?", "vocês abrem sábado?"
--   - Indicar instagram quando ela quiser mostrar resultados
-- ============================================================================

UPDATE clinics
SET settings = jsonb_strip_nulls(jsonb_build_object(
  -- ENDEREÇO COMPLETO (obrigatório se quiser que ela informe local)
  'address', 'Rua Exemplo, 123 - Sala 4 - Centro - Uberlandia/MG - CEP 38400-000',

  -- TELEFONE de contato direto da recepção (opcional — paciente já está no WhatsApp)
  'phone', '(34) 3000-0000',

  -- HORÁRIO de funcionamento (texto livre — pode quebrar em linhas se quiser)
  'hours', 'Segunda a sexta: 08h às 19h. Sábado: 08h às 12h. Domingo: fechado.',

  -- INSTAGRAM da clínica (opcional)
  'instagram', '@clinicasarahpina',

  -- ESTACIONAMENTO/REFERÊNCIAS (opcional — útil pra tirar dúvidas comuns)
  'parking', 'Estacionamento conveniado no edifício, R$ 5 por hora.',

  -- OBSERVAÇÕES extras (opcional — qualquer coisa que ajude a Eva)
  'observations', 'Chegue 10 minutos antes do horário para confortável check-in.'
))
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';   -- ← clinic_id

-- Confirmação
SELECT name, jsonb_pretty(settings) AS settings
FROM clinics
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';
