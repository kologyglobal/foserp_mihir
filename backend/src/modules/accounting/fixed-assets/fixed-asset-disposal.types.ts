import type {
  FixedAsset,
  FixedAssetCategory,
  FixedAssetDisposal,
  FixedAssetDisposalType,
} from '@prisma/client'

export type FixedAssetDisposalRow = FixedAssetDisposal

export type FixedAssetDisposalWithAsset = FixedAssetDisposal & {
  asset: FixedAsset & {
    category: Pick<FixedAssetCategory, 'id' | 'name' | 'assetAccountId' | 'accumDepAccountId'>
  }
}

export interface FixedAssetDisposalValidationIssue {
  field?: string
  code: string
  message: string
}

export interface FixedAssetDisposalValidationResult {
  isValid: boolean
  errors: FixedAssetDisposalValidationIssue[]
  warnings: FixedAssetDisposalValidationIssue[]
}

export type FixedAssetDisposalAccountingLineRole =
  | 'ACCUM_DEP'
  | 'PROCEEDS'
  | 'GST_CGST'
  | 'GST_SGST'
  | 'GST_IGST'
  | 'GST_CESS'
  | 'LOSS'
  | 'ASSET_COST'
  | 'GAIN'

export interface FixedAssetDisposalAccountingLine {
  lineNumber: number
  role: FixedAssetDisposalAccountingLineRole
  accountId?: string | null
  accountMappingKey?: string | null
  direction: 'DEBIT' | 'CREDIT'
  amount: string
  lineNarration: string
}

export interface FixedAssetDisposalAccountingPreview {
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: FixedAssetDisposalAccountingLine[]
}

/** Snapshot of computed amounts — persisted on the document at create/update/recalculate time. */
export interface FixedAssetDisposalCalculationResult {
  acquisitionCostSnapshot: string
  accumulatedDepreciationSnapshot: string
  netBookValueSnapshot: string
  disposedCost: string
  disposedAccumDep: string
  disposedNbv: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalProceeds: string
  gainLoss: string
  proceedsAccountId: string | null
  validation: FixedAssetDisposalValidationResult
  accountingPreview: FixedAssetDisposalAccountingPreview
  calculationVersion: number
}

export interface FixedAssetDisposalDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  assetId: string
  disposalType: FixedAssetDisposalType
  disposalDate: Date
  currencyCode: string
  proceeds: string
  buyerName?: string | null
  reason: string
  proceedsTreasuryAccountId?: string | null
  proceedsAccountIdInput?: string | null
  gstApplicable: boolean
  placeOfSupply?: string | null
  partyGstin?: string | null
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  approvalRequired: boolean
  draftReference: string
  userId?: string | null
}

export type FixedAssetDisposalStatusApi =
  | 'Draft'
  | 'Pending Approval'
  | 'Rejected'
  | 'Ready to Post'
  | 'Posted'
  | 'Cancelled'
  | 'Reversed'

export type FixedAssetDisposalTypeApiV2 = 'Sale' | 'Scrap' | 'Write-off'

export interface FixedAssetDisposalAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  post: boolean
  reverse: boolean
}

export interface FixedAssetDisposalDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  assetId: string
  assetNumber: string
  assetName: string
  disposalNumber: string | null
  draftReference: string
  status: FixedAssetDisposalStatusApi
  disposalType: FixedAssetDisposalTypeApiV2
  isPartial: boolean
  disposalDate: string
  postingDate: string | null
  currencyCode: string
  proceeds: string
  buyerName: string | null
  reason: string
  preDisposalAssetStatus: string | null
  acquisitionCostSnapshot: string | null
  accumulatedDepreciationSnapshot: string | null
  netBookValueSnapshot: string | null
  disposedCost: string | null
  disposedAccumDep: string | null
  disposedNbv: string | null
  gainLoss: string | null
  isGain: boolean | null
  proceedsTreasuryAccountId: string | null
  proceedsAccountId: string | null
  gstApplicable: boolean
  placeOfSupply: string | null
  partyGstin: string | null
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalProceeds: string
  approvalRequired: boolean
  approvalRequestId: string | null
  postingEventId: string | null
  voucherId: string | null
  voucherNumber: string | null
  reversalPostingEventId: string | null
  reversalVoucherId: string | null
  validation: FixedAssetDisposalValidationResult | null
  accountingPreview: FixedAssetDisposalAccountingPreview | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  readyAt: string | null
  postedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  reversedAt: string | null
  reversalDate: string | null
  reversalReason: string | null
  allowedActions: FixedAssetDisposalAllowedActions
  createdAt: string
  updatedAt: string
}

export interface FixedAssetDisposalPreviewResultDto {
  disposalId: string
  assetId: string
  assetNumber: string
  assetName: string
  disposalType: FixedAssetDisposalTypeApiV2
  acquisitionCost: string
  accumulatedDepreciation: string
  netBookValue: string
  proceeds: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalProceeds: string
  gainLoss: string
  isGain: boolean
  currencyCode: string
  validation: FixedAssetDisposalValidationResult
  accountingPreview: FixedAssetDisposalAccountingPreview
}
