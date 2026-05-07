import { permanentRedirect } from 'next/navigation'

/**
 * Rota legacy. A "Central do Paciente" unificou Pacientes + Prontuário em
 * /dashboard/pacientes/[id]?tab=evolucoes. Este redirect 301 mantém os
 * links salvos / bookmarks funcionando.
 */
export default function ProntuarioPatientLegacy({
  params,
}: {
  params: { id: string }
}) {
  permanentRedirect(`/dashboard/pacientes/${params.id}?tab=evolucoes`)
}
