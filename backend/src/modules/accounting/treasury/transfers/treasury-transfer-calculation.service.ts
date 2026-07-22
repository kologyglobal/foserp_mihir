import { prisma } from '../../../../config/database.js'
import { compare, formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { buildTreasuryTransferAccountingPreview } from './treasury-transfer-accounting-preview.service.js'
import { resolveTreasuryTransferAccounts } from './treasury-transfer-account-resolver.service.js'
import { evaluateTreasuryTransferBalance } from './treasury-transfer-balance.service.js'
import { validateTreasuryTransferAccounts } from './treasury-transfer-validation.service.js'
import type {
  TreasuryAccountSnapshot,
  TreasuryTransferCalculationResult,
  TreasuryTransferModeRecommendation,
} from './treasury-transfer.types.js'
import type { TreasuryTransferPostingMode, TreasuryTransferType } from '@prisma/client'
import { TreasuryTransferInTransitRequiredError } from './treasury-transfer.errors.js'

export const TREASURY_TRANSFER_CALCULATION_VERSION = 1

export interface TreasuryTransferCalculationInput {
  tenantId: string
  legalEntityId: string
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  source: TreasuryAccountSnapshot
  destination: TreasuryAccountSnapshot
  currencyCode: string
  exchangeRate: string
  transferAmount: string
  transferDate: string
  sourcePostingDate: string
  expectedReceiptDate?: string | null
  destinationPostingDate?: string | null
  postingModeOverride?: TreasuryTransferPostingMode
}

export function resolveTreasuryTransferType(
  source: TreasuryAccountSnapshot,
  destination: TreasuryAccountSnapshot,
): TreasuryTransferType {
  if (source.accountType === 'BANK' && destination.accountType === 'BANK') return 'BANK_TO_BANK'
  if (source.accountType === 'BANK' && destination.accountType === 'CASH') return 'BANK_TO_CASH'
  if (source.accountType === 'CASH' && destination.accountType === 'BANK') return 'CASH_TO_BANK'
  return 'CASH_TO_CASH'
}

function datesDiffer(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return a !== b
}

export function recommendTreasuryTransferPostingMode(params: {
  transferType: TreasuryTransferType
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  transferDate: string
  sourcePostingDate: string
  expectedReceiptDate?: string | null
  destinationPostingDate?: string | null
  requireInTransit: boolean
  inTransitThreshold: string | null
  baseTransferAmount: string
}): TreasuryTransferModeRecommendation {
  const forceReasons: string[] = []

  let base: TreasuryTransferPostingMode
  const crossBranch = Boolean(
    params.sourceBranchId && params.destinationBranchId && params.sourceBranchId !== params.destinationBranchId,
  )

  switch (params.transferType) {
    case 'BANK_TO_BANK':
      base = 'IN_TRANSIT'
      break
    case 'BANK_TO_CASH':
      base = 'DIRECT'
      break
    case 'CASH_TO_BANK':
      base = 'IN_TRANSIT'
      break
    case 'CASH_TO_CASH':
    default:
      base = crossBranch ? 'IN_TRANSIT' : 'DIRECT'
      break
  }

  if (params.requireInTransit) {
    forceReasons.push('Finance settings require IN_TRANSIT posting for all treasury transfers')
  }
  if (
    params.inTransitThreshold != null &&
    compare(params.baseTransferAmount, params.inTransitThreshold) > 0
  ) {
    forceReasons.push(`Transfer amount exceeds the IN_TRANSIT threshold of ${params.inTransitThreshold}`)
  }
  if (datesDiffer(params.sourcePostingDate, params.destinationPostingDate ?? params.expectedReceiptDate ?? null)) {
    forceReasons.push('Source and destination posting dates differ')
  }
  if (crossBranch) {
    forceReasons.push('Source and destination treasury accounts belong to different branches')
  }

  const forced = forceReasons.length > 0
  const recommendedMode: TreasuryTransferPostingMode = forced ? 'IN_TRANSIT' : base

  return { recommendedMode, forced, forceReasons }
}

export async function calculateTreasuryTransfer(
  input: TreasuryTransferCalculationInput,
): Promise<TreasuryTransferCalculationResult> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId: input.tenantId, legalEntityId: input.legalEntityId } })
  const bankBalancePolicy = (settings?.treasuryTransferBankBalancePolicy as 'ALLOW' | 'WARN' | 'BLOCK' | undefined) ?? 'WARN'
  const requireInTransit = settings?.treasuryTransferRequireInTransit ?? false
  const inTransitThreshold = settings?.treasuryTransferInTransitThreshold
    ? formatForPersistence(settings.treasuryTransferInTransitThreshold)
    : null

  const transferType = resolveTreasuryTransferType(input.source, input.destination)
  const baseTransferAmount = formatForPersistence(toDecimal(input.transferAmount).mul(toDecimal(input.exchangeRate)))

  const modeRecommendation = recommendTreasuryTransferPostingMode({
    transferType,
    sourceBranchId: input.sourceBranchId,
    destinationBranchId: input.destinationBranchId,
    transferDate: input.transferDate,
    sourcePostingDate: input.sourcePostingDate,
    expectedReceiptDate: input.expectedReceiptDate,
    destinationPostingDate: input.destinationPostingDate,
    requireInTransit,
    inTransitThreshold,
    baseTransferAmount,
  })

  let postingMode = modeRecommendation.recommendedMode
  if (input.postingModeOverride) {
    if (modeRecommendation.forced && input.postingModeOverride !== 'IN_TRANSIT') {
      throw new TreasuryTransferInTransitRequiredError(
        `This transfer requires IN_TRANSIT posting mode: ${modeRecommendation.forceReasons.join('; ')}`,
      )
    }
    postingMode = input.postingModeOverride
  }

  const accounts = await resolveTreasuryTransferAccounts({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    currencyCode: input.currencyCode,
    source: input.source,
    destination: input.destination,
    requiresInTransit: postingMode === 'IN_TRANSIT',
  })

  const validation = validateTreasuryTransferAccounts({
    source: input.source,
    destination: input.destination,
    legalEntityId: input.legalEntityId,
    currencyCode: input.currencyCode,
    transferAmount: input.transferAmount,
  })

  const balanceCheck = validation.isValid
    ? await evaluateTreasuryTransferBalance({
        tenantId: input.tenantId,
        accountType: input.source.accountType,
        glAccountId: accounts.sourceGlAccountId,
        transferAmount: baseTransferAmount,
        policy: bankBalancePolicy,
      })
    : {
        policy: bankBalancePolicy,
        availableBalance: '0.0000',
        projectedBalance: '0.0000',
        isBlocking: false,
        warnings: [] as string[],
      }

  if (balanceCheck.isBlocking) {
    validation.errors.push({
      field: 'transferAmount',
      code: 'BALANCE_BLOCKED',
      message: balanceCheck.warnings[0] ?? 'Transfer amount exceeds available source balance',
    })
    validation.isValid = false
  } else if (balanceCheck.warnings.length > 0) {
    validation.warnings.push({ field: 'transferAmount', code: 'BALANCE_WARNING', message: balanceCheck.warnings[0] })
  }

  const accountingPreview = validation.isValid
    ? buildTreasuryTransferAccountingPreview({
        postingMode,
        accounts,
        transferAmount: baseTransferAmount,
        sourceLabel: input.source.name,
        destinationLabel: input.destination.name,
      })
    : {
        step: postingMode === 'DIRECT' ? ('DIRECT' as const) : ('DISPATCH' as const),
        isBalanced: false,
        totalDebit: '0.0000',
        totalCredit: '0.0000',
        lines: [],
      }

  return {
    transferType,
    modeRecommendation,
    postingMode,
    baseTransferAmount,
    accounts,
    balanceCheck,
    validation,
    accountingPreview,
    calculationVersion: TREASURY_TRANSFER_CALCULATION_VERSION,
  }
}
