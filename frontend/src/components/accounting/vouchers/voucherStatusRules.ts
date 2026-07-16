import type { AccountingVoucher, VoucherLifecycleStatus } from '@/types/vouchers'

export function canEditVoucher(status: VoucherLifecycleStatus): boolean {
  return status === 'draft' || status === 'rejected' || status === 'sent_back'
}

export function canSubmitVoucher(status: VoucherLifecycleStatus): boolean {
  return canEditVoucher(status)
}

export function canDeleteVoucher(status: VoucherLifecycleStatus): boolean {
  return status === 'draft'
}

export function canApproveVoucher(status: VoucherLifecycleStatus): boolean {
  return status === 'pending_approval'
}

export function canPostVoucher(status: VoucherLifecycleStatus): boolean {
  return status === 'approved'
}

export function canReverseVoucher(v: Pick<AccountingVoucher, 'status' | 'reversedByVoucherId'>): boolean {
  return v.status === 'posted' && !v.reversedByVoucherId
}

export function canCancelVoucher(status: VoucherLifecycleStatus): boolean {
  return status === 'draft' || status === 'rejected' || status === 'sent_back' || status === 'pending_approval'
}

export function isVoucherReadOnly(status: VoucherLifecycleStatus): boolean {
  return !canEditVoucher(status)
}

export const VOUCHER_WORKFLOW_STEPS: { id: VoucherLifecycleStatus | 'start'; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'posted', label: 'Posted' },
]

export function workflowStepIndex(status: VoucherLifecycleStatus): number {
  if (status === 'reversed' || status === 'cancelled') return -1
  if (status === 'rejected' || status === 'sent_back') return 0
  const idx = VOUCHER_WORKFLOW_STEPS.findIndex((s) => s.id === status)
  return idx >= 0 ? idx : 0
}
