'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import SellProcedureModal from '@/components/vendas/sell-procedure-modal'

type Props = {
  clinicId: string
  userId: string
  patientId: string
  patientName: string
}

export default function SellProcedureButton({ clinicId, userId, patientId, patientName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
        title="Vender procedimento avulso para a paciente, sem precisar de agendamento"
      >
        <Icon name="dollarSign" className="w-4 h-4" />
        Vender procedimento
      </button>

      {open && (
        <SellProcedureModal
          clinicId={clinicId}
          userId={userId}
          patientId={patientId}
          patientName={patientName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
