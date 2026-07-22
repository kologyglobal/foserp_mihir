import type { CorrectionHandler } from '../correction.types.js'
import type { CorrectionTransactionType } from '../correction.enums.js'
import { productionProgressHandler } from './progress-correction.handler.js'
import { materialIssueHandler, materialReturnHandler } from './material-correction.handler.js'
import { wipMovementHandler } from './wip-correction.handler.js'
import { fgReceiptHandler } from './fg-correction.handler.js'
import {
  blockedPolicyHandler,
  jobWorkDispatchHandler,
  jobWorkReceiptHandler,
  qualityDecisionHandler,
  workOrderSplitHandler,
} from './policy-correction.handlers.js'

const dailyLineHandler = blockedPolicyHandler(
  'Daily Production line correction should use PRODUCTION_PROGRESS against the line ledger entry, or use the Daily Production correct-line API',
)
const dailyBatchHandler = blockedPolicyHandler(
  'Full Daily Production batch reversal requires every line to remain reversible — use per-line corrections first, then mark batch reversed',
)

export function getCorrectionHandler(transactionType: CorrectionTransactionType): CorrectionHandler {
  switch (transactionType) {
    case 'PRODUCTION_PROGRESS':
      return productionProgressHandler
    case 'DAILY_PRODUCTION_LINE':
      return dailyLineHandler
    case 'DAILY_PRODUCTION_BATCH':
      return dailyBatchHandler
    case 'MATERIAL_ISSUE':
    case 'ADDITIONAL_MATERIAL_ISSUE':
      return materialIssueHandler
    case 'MATERIAL_RETURN':
      return materialReturnHandler
    case 'MATERIAL_TRANSFER':
    case 'WIP_MOVEMENT':
      return wipMovementHandler
    case 'RESERVATION_TRANSFER':
      return blockedPolicyHandler(
        'Standalone reservation-transfer documents are not implemented',
      )
    case 'FG_RECEIPT':
      return fgReceiptHandler
    case 'JOB_WORK_DISPATCH':
      return jobWorkDispatchHandler
    case 'JOB_WORK_RECEIPT':
    case 'JOB_WORK_RETURN':
    case 'JOB_WORK_RECONCILIATION':
      return jobWorkReceiptHandler
    case 'WORK_ORDER_SPLIT':
      return workOrderSplitHandler
    case 'QUALITY_DECISION':
      return qualityDecisionHandler
    default:
      return blockedPolicyHandler(`Unsupported correction transaction type: ${transactionType}`)
  }
}
