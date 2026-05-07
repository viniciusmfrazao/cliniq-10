import { permanentRedirect } from 'next/navigation'

/**
 * Rota legacy. A lista de pacientes com prontuário virou a própria
 * /dashboard/pacientes (a Central do Paciente cobre cadastro + evoluções
 * + consultas + anamneses + injetáveis em tabs).
 *
 * Mantemos o searchParams.q pra propagar a busca quem vinha de bookmarks
 * antigos (ex: /dashboard/prontuario?q=joao).
 */
export default function ProntuarioListLegacy({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const target = searchParams.q
    ? `/dashboard/pacientes?q=${encodeURIComponent(searchParams.q)}`
    : '/dashboard/pacientes'
  permanentRedirect(target)
}
