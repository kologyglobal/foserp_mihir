import { formatForPersistence } from '../../shared/finance-decimal.js'
import type { TreasuryTransferAccountResolution, TreasuryTransferAccountingPreview } from './treasury-transfer.types.js'

export interface BuildAccountingPreviewParams {
  postingMode: 'DIRECT' | 'IN_TRANSIT'
  accounts: TreasuryTransferAccountResolution
  transferAmount: string
  sourceLabel: string
  destinationLabel: string
}

/**
 * Preview of the *next* accounting action for this transfer:
 *  - DIRECT mode → the single direct posting (Dr destination / Cr source)
 *  - IN_TRANSIT mode → the upcoming dispatch leg (Dr clearing / Cr source); the receive leg
 *    (Dr destination / Cr clearing) is previewed separately once the transfer is IN_TRANSIT.
 */
export function buildTreasuryTransferAccountingPreview(params: BuildAccountingPreviewParams): TreasuryTransferAccountingPreview {
  const amount = formatForPersistence(params.transferAmount)

  if (params.postingMode === 'DIRECT') {
    return {
      step: 'DIRECT',
      isBalanced: true,
      totalDebit: amount,
      totalCredit: amount,
      lines: [
        {
          lineNumber: 1,
          role: 'DESTINATION',
          accountId: params.accounts.destinationGlAccountId,
          direction: 'DEBIT',
          amount,
          lineNarration: `Treasury transfer received — ${params.destinationLabel}`,
        },
        {
          lineNumber: 2,
          role: 'SOURCE',
          accountId: params.accounts.sourceGlAccountId,
          direction: 'CREDIT',
          amount,
          lineNarration: `Treasury transfer sent — ${params.sourceLabel}`,
        },
      ],
    }
  }

  if (!params.accounts.inTransitGlAccountId) {
    throw new Error('In-transit clearing GL account is required to build the dispatch preview')
  }

  return {
    step: 'DISPATCH',
    isBalanced: true,
    totalDebit: amount,
    totalCredit: amount,
    lines: [
      {
        lineNumber: 1,
        role: 'CLEARING',
        accountId: params.accounts.inTransitGlAccountId,
        direction: 'DEBIT',
        amount,
        lineNarration: `Treasury transfer in transit — ${params.sourceLabel} to ${params.destinationLabel}`,
      },
      {
        lineNumber: 2,
        role: 'SOURCE',
        accountId: params.accounts.sourceGlAccountId,
        direction: 'CREDIT',
        amount,
        lineNarration: `Treasury transfer dispatched — ${params.sourceLabel}`,
      },
    ],
  }
}

export function buildTreasuryTransferReceivePreview(params: BuildAccountingPreviewParams): TreasuryTransferAccountingPreview {
  const amount = formatForPersistence(params.transferAmount)
  if (!params.accounts.inTransitGlAccountId) {
    throw new Error('In-transit clearing GL account is required to build the receive preview')
  }
  return {
    step: 'RECEIVE',
    isBalanced: true,
    totalDebit: amount,
    totalCredit: amount,
    lines: [
      {
        lineNumber: 1,
        role: 'DESTINATION',
        accountId: params.accounts.destinationGlAccountId,
        direction: 'DEBIT',
        amount,
        lineNarration: `Treasury transfer received — ${params.destinationLabel}`,
      },
      {
        lineNumber: 2,
        role: 'CLEARING',
        accountId: params.accounts.inTransitGlAccountId,
        direction: 'CREDIT',
        amount,
        lineNarration: `Treasury transfer clearing settled — ${params.destinationLabel}`,
      },
    ],
  }
}
