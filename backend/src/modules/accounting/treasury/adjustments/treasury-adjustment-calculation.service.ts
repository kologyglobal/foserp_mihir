import type { GstTreatment, TreasuryAdjustmentDirection, TreasuryAdjustmentLineType, TreasuryAdjustmentType } from '@prisma/client'
import { compare, divide, formatForPersistence, multiply, subtract, toDecimal } from '../../shared/finance-decimal.js'
import { resolveLineAccountId } from './treasury-adjustment-account-resolver.service.js'
import type {
  ResolvedAdjustmentLine,
  TreasuryAdjustmentAccountingPreview,
  TreasuryAdjustmentCalculationResult,
  TreasuryAdjustmentLineInput,
  TreasuryAdjustmentValidationIssue,
  TreasuryAdjustmentValidationResult,
} from './treasury-adjustment.types.js'

export const TREASURY_ADJUSTMENT_CALCULATION_VERSION = 1

/** Fixed direction per adjustment type — only GST_ADJUSTMENT lets the caller choose (§18). */
const FIXED_DIRECTION: Partial<Record<TreasuryAdjustmentType, TreasuryAdjustmentDirection>> = {
  BANK_CHARGES: 'BANK_DEBIT',
  BANK_INTEREST_INCOME: 'BANK_CREDIT',
  BANK_INTEREST_EXPENSE: 'BANK_DEBIT',
  COLLECTION_FEE: 'BANK_DEBIT',
  MERCHANT_FEE: 'BANK_DEBIT',
  DIRECT_DEBIT: 'BANK_DEBIT',
  DIRECT_CREDIT: 'BANK_CREDIT',
  STANDING_INSTRUCTION_DEBIT: 'BANK_DEBIT',
  STANDING_INSTRUCTION_CREDIT: 'BANK_CREDIT',
  OTHER_BANK_DEBIT: 'BANK_DEBIT',
  OTHER_BANK_CREDIT: 'BANK_CREDIT',
}

export function resolveDirection(adjustmentType: TreasuryAdjustmentType, provided?: TreasuryAdjustmentDirection | null): TreasuryAdjustmentDirection {
  const fixed = FIXED_DIRECTION[adjustmentType]
  if (fixed) return fixed
  // GST_ADJUSTMENT — caller-supplied, required (enforced by schema superRefine).
  return provided ?? 'BANK_DEBIT'
}

/** Natural debit/credit side for a resolved line — see architecture doc §30-31 for the balancing rationale. */
function naturalSide(lineType: TreasuryAdjustmentLineType, amount: string, direction: TreasuryAdjustmentDirection): 'DEBIT' | 'CREDIT' {
  if (lineType === 'ROUND_OFF') return compare(amount, '0') < 0 ? 'CREDIT' : 'DEBIT'
  if (['EXPENSE', 'ASSET', 'RECOVERABLE_TAX', 'NON_RECOVERABLE_TAX', 'TDS_RECEIVABLE'].includes(lineType)) return 'DEBIT'
  if (['INCOME', 'LIABILITY'].includes(lineType)) return 'CREDIT'
  // OTHER — mirrors the offset side implied by the adjustment direction (opposite of the bank leg).
  return direction === 'BANK_DEBIT' ? 'DEBIT' : 'CREDIT'
}

function gstLineType(gstTreatment: GstTreatment): TreasuryAdjustmentLineType {
  return gstTreatment === 'GST_NON_RECOVERABLE' ? 'NON_RECOVERABLE_TAX' : 'RECOVERABLE_TAX'
}

/** Expands raw input lines into persistable lines, auto-deriving GST/TDS tax lines from rate inputs. */
export async function resolveAdjustmentLines(params: {
  tenantId: string
  legalEntityId: string
  direction: TreasuryAdjustmentDirection
  lines: TreasuryAdjustmentLineInput[]
}): Promise<ResolvedAdjustmentLine[]> {
  const resolved: ResolvedAdjustmentLine[] = []
  let lineNumber = 1

  for (const input of params.lines) {
    const accountId = await resolveLineAccountId({
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      accountId: input.accountId,
      mappingKey: input.mappingKey,
    })
    const amount = formatForPersistence(input.amount)
    const gstTreatment = input.gstTreatment ?? 'GST_NOT_APPLICABLE'
    const tdsTreatment = input.tdsTreatment ?? 'TDS_NOT_APPLICABLE'

    resolved.push({
      lineNumber: lineNumber++,
      lineType: input.lineType,
      accountId,
      description: input.description ?? null,
      amount,
      gstTreatment,
      gstRate: input.gstRate != null ? formatForPersistence(input.gstRate, 2) : null,
      tdsTreatment,
      tdsRate: input.tdsRate != null ? formatForPersistence(input.tdsRate, 2) : null,
      narration: input.narration ?? null,
      side: naturalSide(input.lineType, amount, params.direction),
    })

    if ((gstTreatment === 'GST_APPLICABLE' || gstTreatment === 'GST_NON_RECOVERABLE') && input.gstRate != null) {
      const gstAmount = formatForPersistence(divide(multiply(amount, input.gstRate), '100'))
      const derivedType = gstLineType(gstTreatment)
      const gstAccountId = await resolveLineAccountId({
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        accountId: input.gstAccountId,
        mappingKey: input.gstMappingKey,
      })
      resolved.push({
        lineNumber: lineNumber++,
        lineType: derivedType,
        accountId: gstAccountId,
        description: `GST on ${input.description ?? input.lineType}`,
        amount: gstAmount,
        gstTreatment: 'GST_NOT_APPLICABLE',
        gstRate: null,
        tdsTreatment: 'TDS_NOT_APPLICABLE',
        tdsRate: null,
        narration: null,
        side: naturalSide(derivedType, gstAmount, params.direction),
      })
    }

    if (tdsTreatment === 'TDS_DEDUCTED' && input.tdsRate != null) {
      const tdsAmount = formatForPersistence(divide(multiply(amount, input.tdsRate), '100'))
      const tdsAccountId = await resolveLineAccountId({
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        accountId: input.tdsAccountId,
        mappingKey: input.tdsMappingKey ?? 'TDS_RECEIVABLE',
      })
      resolved.push({
        lineNumber: lineNumber++,
        lineType: 'TDS_RECEIVABLE',
        accountId: tdsAccountId,
        description: `TDS on ${input.description ?? input.lineType}`,
        amount: tdsAmount,
        gstTreatment: 'GST_NOT_APPLICABLE',
        gstRate: null,
        tdsTreatment: 'TDS_NOT_APPLICABLE',
        tdsRate: null,
        narration: null,
        side: naturalSide('TDS_RECEIVABLE', tdsAmount, params.direction),
      })
    }
  }

  return resolved
}

export function computeBankAmount(direction: TreasuryAdjustmentDirection, lines: ResolvedAdjustmentLine[]): string {
  let debit = toDecimal(0)
  let credit = toDecimal(0)
  for (const line of lines) {
    const amt = toDecimal(line.amount).abs()
    if (line.side === 'DEBIT') debit = debit.add(amt)
    else credit = credit.add(amt)
  }
  const bankAmount = direction === 'BANK_DEBIT' ? subtract(debit, credit) : subtract(credit, debit)
  return formatForPersistence(bankAmount)
}

function buildAccountingPreview(direction: TreasuryAdjustmentDirection, bankGlAccountId: string, bankAmount: string, lines: ResolvedAdjustmentLine[]): TreasuryAdjustmentAccountingPreview {
  const previewLines = lines.map((line, idx) => ({
    lineNumber: idx + 1,
    role: 'OFFSET' as const,
    accountId: line.accountId,
    direction: line.side,
    amount: toDecimal(line.amount).abs().toFixed(4),
    lineNarration: (line.narration ?? line.description ?? line.lineType).slice(0, 500),
  }))
  const bankLine = {
    lineNumber: previewLines.length + 1,
    role: 'BANK' as const,
    accountId: bankGlAccountId,
    direction: (direction === 'BANK_DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
    amount: bankAmount,
    lineNarration: 'Treasury adjustment — bank leg',
  }
  const allLines = [...previewLines, bankLine]
  const totalDebit = allLines.filter((l) => l.direction === 'DEBIT').reduce((acc, l) => acc.add(toDecimal(l.amount)), toDecimal(0))
  const totalCredit = allLines.filter((l) => l.direction === 'CREDIT').reduce((acc, l) => acc.add(toDecimal(l.amount)), toDecimal(0))
  return {
    isBalanced: totalDebit.eq(totalCredit) && totalDebit.gt(0),
    totalDebit: totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    lines: allLines,
  }
}

function validate(params: {
  bankAmount: string
  lines: ResolvedAdjustmentLine[]
  adjustmentType: TreasuryAdjustmentType
  narration?: string | null
}): TreasuryAdjustmentValidationResult {
  const errors: TreasuryAdjustmentValidationIssue[] = []
  const warnings: TreasuryAdjustmentValidationIssue[] = []

  if (params.lines.length === 0) {
    errors.push({ field: 'lines', code: 'LINES_REQUIRED', message: 'At least one offset line is required' })
  }
  for (const line of params.lines) {
    if (line.lineType !== 'ROUND_OFF' && compare(line.amount, '0') <= 0) {
      errors.push({ field: 'lines', code: 'LINE_AMOUNT_INVALID', message: `Line amount must be positive for line type ${line.lineType}` })
    }
  }
  if (compare(params.bankAmount, '0') <= 0) {
    errors.push({
      field: 'lines',
      code: 'BANK_AMOUNT_NOT_POSITIVE',
      message: 'Offset lines do not produce a positive bank amount for the selected direction — check line types and amounts',
    })
  }
  if (['OTHER_BANK_DEBIT', 'OTHER_BANK_CREDIT'].includes(params.adjustmentType) && !params.narration?.trim()) {
    errors.push({ field: 'narration', code: 'NARRATION_REQUIRED', message: 'Narration is required for OTHER_BANK_* adjustment types' })
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export interface TreasuryAdjustmentCalculationInput {
  tenantId: string
  legalEntityId: string
  bankGlAccountId: string
  adjustmentType: TreasuryAdjustmentType
  direction?: TreasuryAdjustmentDirection | null
  narration?: string | null
  lines: TreasuryAdjustmentLineInput[]
}

export async function calculateTreasuryAdjustment(input: TreasuryAdjustmentCalculationInput): Promise<TreasuryAdjustmentCalculationResult> {
  const direction = resolveDirection(input.adjustmentType, input.direction)
  const resolvedLines = await resolveAdjustmentLines({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    direction,
    lines: input.lines,
  })
  return computeFromResolvedLines({
    direction,
    bankGlAccountId: input.bankGlAccountId,
    adjustmentType: input.adjustmentType,
    narration: input.narration,
    resolvedLines,
  })
}

/**
 * Recomputes bank amount / validation / preview directly from already-resolved (persisted) lines —
 * used by recalculate-on-workflow/posting so GST/TDS derived lines are never expanded a second time.
 */
export function computeFromResolvedLines(input: {
  direction: TreasuryAdjustmentDirection
  bankGlAccountId: string
  adjustmentType: TreasuryAdjustmentType
  narration?: string | null
  resolvedLines: ResolvedAdjustmentLine[]
}): TreasuryAdjustmentCalculationResult {
  const resolvedLines = input.resolvedLines.map((line) => ({ ...line, side: naturalSide(line.lineType, line.amount, input.direction) }))
  const bankAmount = computeBankAmount(input.direction, resolvedLines)
  const validation = validate({ bankAmount, lines: resolvedLines, adjustmentType: input.adjustmentType, narration: input.narration })
  const accountingPreview = validation.isValid
    ? buildAccountingPreview(input.direction, input.bankGlAccountId, bankAmount, resolvedLines)
    : { isBalanced: false, totalDebit: '0.0000', totalCredit: '0.0000', lines: [] }

  return {
    direction: input.direction,
    bankAmount,
    resolvedLines,
    validation,
    accountingPreview,
    calculationVersion: TREASURY_ADJUSTMENT_CALCULATION_VERSION,
  }
}
