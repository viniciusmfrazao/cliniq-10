'use client'

import { useRouter } from 'next/navigation'
import VendaModal from '@/components/vendas/venda-modal'

/**
 * A rota /financeiro/entradas/nova passou a usar o mesmo modal de venda da ficha
 * do paciente e da agenda — uma implementação só, em vez de quatro formulários
 * que divergiam entre si (o antigo entrada-form não gravava entrada_procedimentos
 * e não deixava misturar procedimento com produto).
 */
export default function NovaVendaClient({ clinicId, userId }: { clinicId: string; userId: string }) {
  const router = useRouter()

  return (
    <VendaModal
      clinicId={clinicId}
      userId={userId}
      patientId={null}
      patientName=""
      selecionarPaciente
      onClose={() => router.push('/dashboard/financeiro/entradas')}
    />
  )
}
