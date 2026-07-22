import type {
  Prisma,
  TreasuryAccountType,
  TreasuryTransfer,
  TreasuryTransferPostingMode,
  TreasuryTransferPurpose,
  TreasuryTransferType,
} from '@prisma/client'

export type TreasuryTransferRow = TreasuryTransfer

export interface TreasuryTransferAccountingLine {
  lineNumber: number
  role: 'SOURCE' | 'DESTINATION' | 'CLEARING'
  accountId: string
  direction: 'DEBIT' | 'CREDIT'
  amount: string
  lineNarration: string
}

export interface TreasuryTransferAccountingPreview {
  step: 'DIRECT' | 'DISPATCH' | 'RECEIVE'
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: TreasuryTransferAccountingLine[]
}

export interface TreasuryTransferModeRecommendation {
  recommendedMode: TreasuryTransferPostingMode
  forced: boolean
  forceReasons: string[]
}

export interface TreasuryTransferBalanceCheck {
  policy: 'ALLOW' | 'WARN' | 'BLOCK'
  availableBalance: string
  projectedBalance: string
  isBlocking: boolean
  warnings: string[]
}

export interface TreasuryTransferValidationIssue {
  field?: string
  code: string
  message: string
}

export interface TreasuryTransferValidationResult {
  isValid: boolean
  errors: TreasuryTransferValidationIssue[]
  warnings: TreasuryTransferValidationIssue[]
}

export interface TreasuryTransferAccountResolution {
  sourceGlAccountId: string
  destinationGlAccountId: string
  inTransitGlAccountId: string | null
  inTransitSource: 'DEFAULT_MAPPING' | 'CLEARING_TREASURY_ACCOUNT' | 'NOT_REQUIRED' | 'UNRESOLVED'
}

export interface TreasuryTransferCalculationResult {
  transferType: TreasuryTransferType
  modeRecommendation: TreasuryTransferModeRecommendation
  postingMode: TreasuryTransferPostingMode
  baseTransferAmount: string
  accounts: TreasuryTransferAccountResolution
  balanceCheck: TreasuryTransferBalanceCheck
  validation: TreasuryTransferValidationResult
  accountingPreview: TreasuryTransferAccountingPreview
  calculationVersion: number
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
  maskedNumber: string | null
}

export interface TreasuryTransferDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  sourceTreasuryAccountId: string
  destinationTreasuryAccountId: string
  transferPurpose: TreasuryTransferPurpose
  transferDate: Date
  sourcePostingDate: Date
  expectedReceiptDate?: Date | null
  destinationPostingDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  transferAmount: Prisma.Decimal | number | string
  externalReference?: string | null
  narration?: string | null
  internalNote?: string | null
  draftReference: string
  approvalRequired: boolean
  userId?: string | null
}

export interface TreasuryTransferWithSnapshot extends TreasuryTransferRow {}
