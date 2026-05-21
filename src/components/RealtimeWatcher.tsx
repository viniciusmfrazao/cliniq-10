'use client'

import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

/**
 * Componente leve para adicionar realtime em qualquer Server Component.
 * Não renderiza nada — só escuta mudanças e chama router.refresh().
 * 
 * Uso: <RealtimeWatcher table="anamneses" column="patient_id" value={patientId} />
 */
export default function RealtimeWatcher({
  table,
  column,
  value,
  event = '*',
}: {
  table: string
  column: string
  value: string
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
}) {
  useRealtimeRefresh({
    table,
    event,
    filter: { column, value },
  })
  return null
}
