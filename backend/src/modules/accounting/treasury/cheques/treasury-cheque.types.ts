import type { Prisma, TreasuryAccountType, TreasuryCheque, TreasuryChequeAccountingMode, TreasuryChequeDirection } from '@prisma/client'

export type TreasuryChequeRow = TreasuryCheque

export interface TreasuryChequeAccountingLine {
  lineNumber: number
  role: 'BANK' | 'COUNTERPART'
  accountId: string
  direction: 'DEBIT' | 'CREDIT'
  amount: string
  lineNarration: string
}

export interface TreasuryChequeAccountingPreview {
  step: 'ISSUE' | 'DEPOSIT'
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: TreasuryChequeAccountingLine[]
}

export interface TreasuryChequeValidationIssue {
  field?: string
  code: string
  message: string
}

export interface TreasuryChequeValidationResult {
  isValid: boolean
  errors: TreasuryChequeValidationIssue[]
  warnings: TreasuryChequeValidationIssue[]
}

export interface TreasuryAccountSnapshot {
  id: string
  code: string
  name: string
  accountType: TreasuryAccountType
  currencyCode: string
  glAccountId: string
  status: string
  legalEntityId: string
  branchId: string | null
}

export interface TreasuryChequeCounterpartResolution {
  counterpartGlAccountId: string | null
  counterpartSource: 'PROVIDED' | 'DEFAULT_MAPPING' | 'UNRESOLVED'
}

export interface TreasuryChequeCalculationResult {
  baseAmount: string
  isTrackOnly: boolean
  counterpart: TreasuryChequeCounterpartResolution
  validation: TreasuryChequeValidationResult
  accountingPreview: TreasuryChequeAccountingPreview
  calculationVersion: number
}

export interface TreasuryChequeDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  direction: TreasuryChequeDirection
  accountingMode: TreasuryChequeAccountingMode
  chequeNumber: string
  chequeDate: Date
  bankName?: string | null
  branchName?: string | null
  ifsc?: string | null
  payeeOrDrawerName: string
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  amount: Prisma.Decimal | number | string
  isPdc: boolean
  pdcMaturityDate?: Date | null
  counterpartGlAccountId?: string | null
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
  narration?: string | null
  internalNote?: string | null
  draftReference: string
  approvalRequired: boolean
  userId?: string | null
}
