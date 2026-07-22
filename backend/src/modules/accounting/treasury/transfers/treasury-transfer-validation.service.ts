import type { TreasuryAccountSnapshot, TreasuryTransferValidationIssue, TreasuryTransferValidationResult } from './treasury-transfer.types.js'

export interface ValidateTreasuryTransferAccountsParams {
  source: TreasuryAccountSnapshot
  destination: TreasuryAccountSnapshot
  legalEntityId: string
  currencyCode: string
  transferAmount: string
}

const ELIGIBLE_ACCOUNT_TYPES = new Set(['BANK', 'CASH'])

export function validateTreasuryTransferAccounts(params: ValidateTreasuryTransferAccountsParams): TreasuryTransferValidationResult {
  const errors: TreasuryTransferValidationIssue[] = []
  const warnings: TreasuryTransferValidationIssue[] = []
  const { source, destination } = params

  if (source.id === destination.id) {
    errors.push({
      field: 'destinationTreasuryAccountId',
      code: 'SAME_ACCOUNT',
      message: 'Source and destination treasury accounts must be different',
    })
  }

  if (!ELIGIBLE_ACCOUNT_TYPES.has(source.accountType)) {
    errors.push({
      field: 'sourceTreasuryAccountId',
      code: 'ACCOUNT_TYPE_NOT_SUPPORTED',
      message: 'Only BANK and CASH treasury accounts can be used as the source of an internal transfer',
    })
  }
  if (!ELIGIBLE_ACCOUNT_TYPES.has(destination.accountType)) {
    errors.push({
      field: 'destinationTreasuryAccountId',
      code: 'ACCOUNT_TYPE_NOT_SUPPORTED',
      message: 'Only BANK and CASH treasury accounts can be used as the destination of an internal transfer',
    })
  }

  if (source.status !== 'ACTIVE') {
    errors.push({ field: 'sourceTreasuryAccountId', code: 'ACCOUNT_INACTIVE', message: 'Source treasury account is not active' })
  }
  if (destination.status !== 'ACTIVE') {
    errors.push({ field: 'destinationTreasuryAccountId', code: 'ACCOUNT_INACTIVE', message: 'Destination treasury account is not active' })
  }

  if (source.legalEntityId !== params.legalEntityId || destination.legalEntityId !== params.legalEntityId) {
    errors.push({
      field: 'legalEntityId',
      code: 'DIFFERENT_LEGAL_ENTITY',
      message: 'Source and destination treasury accounts must belong to the same legal entity as the transfer',
    })
  }

  if (source.currencyCode !== params.currencyCode || destination.currencyCode !== params.currencyCode) {
    errors.push({
      field: 'currencyCode',
      code: 'CURRENCY_MISMATCH',
      message: 'Source and destination treasury accounts must share the transfer currency',
    })
  }

  if (Number(params.transferAmount) <= 0) {
    errors.push({ field: 'transferAmount', code: 'AMOUNT_NOT_POSITIVE', message: 'Transfer amount must be greater than zero' })
  }

  return { isValid: errors.length === 0, errors, warnings }
}
