import { createClient } from '@/lib/supabase/server'
import OdontogramClient from '@/components/odontogram/OdontogramClient'

export default async function OdontogramTab({
  patientId,
  clinicId,
  appointmentId,
}: {
  patientId: string
  clinicId: string
  appointmentId?: string
}) {
  const supabase = await createClient()

  // Buscar odontograma mais recente do paciente
  const { data } = await supabase
    .from('odontograms')
    .select('*, odontogram_teeth(*)')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <OdontogramClient
      patientId={patientId}
      clinicId={clinicId}
      appointmentId={appointmentId}
      initialData={data}
    />
  )
}
