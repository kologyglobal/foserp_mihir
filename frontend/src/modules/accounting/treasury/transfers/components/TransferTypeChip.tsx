import { Banknote, Landmark } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { TreasuryTransferType } from '../api/treasury-transfer.types'
import { TRANSFER_TYPE_LABELS } from '../utils/treasuryTransferUi'

const ICONS: Record<TreasuryTransferType, [typeof Landmark, typeof Landmark]> = {
  BANK_TO_BANK: [Landmark, Landmark],
  BANK_TO_CASH: [Landmark, Banknote],
  CASH_TO_BANK: [Banknote, Landmark],
  CASH_TO_CASH: [Banknote, Banknote],
}

export function TransferTypeChip({ type, className }: { type: TreasuryTransferType; className?: string }) {
  const [FromIcon, ToIcon] = ICONS[type] ?? [Landmark, Landmark]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-erp-surface-alt px-2 py-1 text-[11px] font-medium text-erp-text ring-1 ring-inset ring-erp-border',
        className,
      )}
    >
      <FromIcon className="h-3.5 w-3.5 text-erp-muted" />
      <span>{TRANSFER_TYPE_LABELS[type] ?? type}</span>
      <ToIcon className="h-3.5 w-3.5 text-erp-muted" />
    </span>
  )
}
