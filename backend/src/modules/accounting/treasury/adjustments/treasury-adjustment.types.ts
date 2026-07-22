import type {
  GstTreatment,
  Prisma,
  TdsTreatment,
  TreasuryAdjustment,
  TreasuryAdjustmentDirection,
  TreasuryAdjustmentLine,
  TreasuryAdjustmentLineType,
  TreasuryAdjustmentSourceMode,
  TreasuryAdjustmentType,
} from '@prisma/client'

export type TreasuryAdjustmentRow = TreasuryAdjustment
export type TreasuryAdjustmentLineRow = TreasuryAdjustmentLine
export type TreasuryAdjustmentWithLines = TreasuryAdjustment & { lines: TreasuryAdjustmentLine[] }

export interface TreasuryAccountSnapshot {
  id: string
  code: string
  name: string
  accountType: string
  currencyCode: string
  glAccountId: string
  status: string
  legalEntityId: string
  branchId: string | null
}

export interface TreasuryAdjustmentValidationIssue {
  field?: string
  code: string
  message: string
}

export interface TreasuryAdjustmentValidationResult {
  isValid: boolean
  errors: TreasuryAdjustmentValidationIssue[]
  warnings: TreasuryAdjustmentValidationIssue[]
}

export interface TreasuryAdjustmentAccountingLine {
  lineNumber: number
  role: 'BANK' | 'OFFSET'
  accountId: string
  direction: 'DEBIT' | 'CREDIT'
  amount: string
  lineNarration: string
}

export interface TreasuryAdjustmentAccountingPreview {
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: TreasuryAdjustmentAccountingLine[]
}

/** One resolved, persistable offset line — after mapping-key resolution and GST/TDS auto-derivation. */
export interface ResolvedAdjustmentLine {
  lineNumber: number
  lineType: TreasuryAdjustmentLineType
  accountId: string
  description: string | null
  amount: string
  gstTreatment: GstTreatment
  gstRate: string | null
  tdsTreatment: TdsTreatment
  tdsRate: string | null
  narration: string | null
  /** DEBIT/CREDIT side this line contributes to, per the natural-side rules (see calculation service). */
  side: 'DEBIT' | 'CREDIT'
}

export interface TreasuryAdjustmentCalculationResult {
  direction: TreasuryAdjustmentDirection
  bankAmount: string
  resolvedLines: ResolvedAdjustmentLine[]
  validation: TreasuryAdjustmentValidationResult
  accountingPreview: TreasuryAdjustmentAccountingPreview
  calculationVersion: number
}

export interface TreasuryAdjustmentLineInput {
  lineType: TreasuryAdjustmentLineType
  accountId?: string | null
  mappingKey?: string | null
  description?: string | null
  amount: string | number
  gstTreatment?: GstTreatment
  gstRate?: string | number | null
  gstAccountId?: string | null
  gstMappingKey?: string | null
  tdsTreatment?: TdsTreatment
  tdsRate?: string | number | null
  tdsAccountId?: string | null
  tdsMappingKey?: string | null
  narration?: string | null
}

export interface TreasuryAdjustmentDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  adjustmentType: TreasuryAdjustmentType
  direction?: TreasuryAdjustmentDirection | null
  sourceMode: TreasuryAdjustmentSourceMode
  adjustmentDate: Date
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  narration?: string | null
  internalNote?: string | null
  bankStatementLineId?: string | null
  standingInstructionExecutionId?: string | null
  draftReference: string
  approvalRequired: boolean
  userId?: string | null
  lines: TreasuryAdjustmentLineInput[]
}
