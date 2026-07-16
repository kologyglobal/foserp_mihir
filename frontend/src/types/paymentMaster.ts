import type { MasterRecordAudit } from './master'

/** BC Payment Method — balance account posting type */
export type PaymentBalanceAccountType = 'gl_account' | 'bank_account'

export const PAYMENT_BAL_ACCOUNT_TYPE_LABELS: Record<PaymentBalanceAccountType, string> = {
  gl_account: 'G/L Account',
  bank_account: 'Bank Account',
}

export interface PaymentMethod extends MasterRecordAudit {
  id: string
  /** BC Code (max 10) */
  code: string
  description: string
  balAccountType: PaymentBalanceAccountType
  /** BC Bal. Account No. */
  balAccountNo: string
  /** BC Direct Debit */
  directDebit: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}
