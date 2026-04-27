-- ============================================================
-- BUCKETS DE STORAGE
-- ============================================================
-- Cria 2 buckets:
--   medical-attachments  -> fotos do prontuário (privado)
--   whatsapp-media       -> mídias enviadas/recebidas no chat
--
-- Roda este script UMA VEZ no SQL Editor do Supabase.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Bucket: medical-attachments
-- ------------------------------------------------------------
-- Privado. Só usuários da clínica podem ler.
-- Estrutura de path: <clinic_id>/<patient_id>/<file>.jpg
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-attachments',
  'medical-attachments',
  false,
  20971520, -- 20MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ------------------------------------------------------------
-- Bucket: whatsapp-media
-- ------------------------------------------------------------
-- Privado. Mídias trocadas em conversas (recebidas e enviadas).
-- Estrutura de path: <clinic_id>/<phone>/<message_id>.<ext>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  false,
  41943040, -- 40MB (vídeos podem ser maiores)
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/ogg','audio/mpeg','audio/mp4','audio/webm','audio/wav',
    'video/mp4','video/3gpp','video/quicktime','video/webm',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ------------------------------------------------------------
-- RLS: medical-attachments
-- Path layout: <clinic_id>/<patient_id>/<file>
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "med_attach_select_own_clinic" ON storage.objects;
CREATE POLICY "med_attach_select_own_clinic" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "med_attach_insert_own_clinic" ON storage.objects;
CREATE POLICY "med_attach_insert_own_clinic" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "med_attach_update_own_clinic" ON storage.objects;
CREATE POLICY "med_attach_update_own_clinic" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "med_attach_delete_own_clinic" ON storage.objects;
CREATE POLICY "med_attach_delete_own_clinic" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- RLS: whatsapp-media
-- Path layout: <clinic_id>/<phone>/<file>
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "wa_media_select_own_clinic" ON storage.objects;
CREATE POLICY "wa_media_select_own_clinic" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "wa_media_insert_own_clinic" ON storage.objects;
CREATE POLICY "wa_media_insert_own_clinic" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM users WHERE id = auth.uid()
    )
  );

-- service_role (webhook + cron) ja bypass RLS — nao precisa de policy
-- pra receber mensagens vindas do whatsapp.


-- ------------------------------------------------------------
-- Verificação
-- ------------------------------------------------------------
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('medical-attachments', 'whatsapp-media');
