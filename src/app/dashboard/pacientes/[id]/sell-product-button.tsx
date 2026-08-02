'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import SellProductModal from '@/components/vendas/sell-product-modal'

type Props = {
  clinicId: string
  userId: string
  patientId: string
  patientName: string
}

export default function SellProductButton({ clinicId, userId, patientId, patientName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
        title="Vender produto do estoque para a paciente, sem precisar de agendamento"
      >
        <Icon name="box" className="w-4 h-4" />
        Vender produto
      </button>

      {open && (
        <SellProductModal
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
