'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import VendaModal from '@/components/vendas/venda-modal'

type Props = {
  clinicId: string
  userId: string
  patientId: string
  patientName: string
}

export default function VendaButton({ clinicId, userId, patientId, patientName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
        title="Vender procedimentos e/ou produtos para a paciente, sem precisar de agendamento"
      >
        <Icon name="dollarSign" className="w-4 h-4" />
        Nova venda
      </button>

      {open && (
        <VendaModal
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
