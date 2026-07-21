import { isPositive } from '../../shared/finance-decimal.js'
import type {
  TreasuryAccountSnapshot,
  TreasuryChequeCounterpartResolution,
  TreasuryChequeValidationResult,
} from './treasury-cheque.types.js'

export interface ValidateTreasuryChequeParams {
  treasuryAccount: TreasuryAccountSnapshot
  currencyCode: string
  amount: string
  isPdc: boolean
  pdcMaturityDate?: string | null
  chequeDate: string
  isTrackOnly: boolean
  counterpart: TreasuryChequeCounterpartResolution
  requireCounterpartAccount: boolean
}

export function validateTreasuryCheque(params: ValidateTreasuryChequeParams): TreasuryChequeValidationResult {
  const errors: TreasuryChequeValidationResult['errors'] = []
  const warnings: TreasuryChequeValidationResult['warnings'] = []

  if (params.treasuryAccount.status !== 'ACTIVE') {
    errors.push({ field: 'treasuryAccountId', code: 'ACCOUNT_INACTIVE', message: 'Treasury account is not active' })
  }
  if (params.currencyCode !== params.treasuryAccount.currencyCode) {
    errors.push({
      field: 'currencyCode',
      code: 'CURRENCY_MISMATCH',
      message: `Cheque currency (${params.currencyCode}) must match the treasury account currency (${params.treasuryAccount.currencyCode})`,
    })
  }
  if (!isPositive(params.amount)) {
    errors.push({ field: 'amount', code: 'AMOUNT_INVALID', message: 'Cheque amount must be greater than zero' })
  }
  if (params.isPdc && !params.pdcMaturityDate) {
    errors.push({ field: 'pdcMaturityDate', code: 'PDC_MATURITY_DATE_REQUIRED', message: 'PDC maturity date is required for post-dated cheques' })
  }
  if (params.isPdc && params.pdcMaturityDate && params.pdcMaturityDate < params.chequeDate) {
    warnings.push({ field: 'pdcMaturityDate', code: 'PDC_MATURITY_BEFORE_CHEQUE_DATE', message: 'PDC maturity date is before the cheque date' })
  }

  if (!params.isTrackOnly) {
    if (!params.counterpart.counterpartGlAccountId) {
      if (params.requireCounterpartAccount) {
        errors.push({
          field: 'counterpartGlAccountId',
          code: 'COUNTERPART_ACCOUNT_MISSING',
          message: 'No counterpart GL account is configured for this cheque direction — provide one or configure a default mapping',
        })
      } else {
        warnings.push({
          field: 'counterpartGlAccountId',
          code: 'COUNTERPART_ACCOUNT_MISSING',
          message: 'No counterpart GL account resolved — issue/deposit will be blocked until one is provided or mapped',
        })
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings }
}
