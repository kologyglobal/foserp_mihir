import { parseCamtFamilyBuffer } from './bank-statement-camt-common.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'

/** ISO 20022 CAMT.054 (BankToCustomerDebitCreditNotification) — provisional. */
export function parseCamt054Buffer(buffer: Buffer): NativeStatementParseResult {
  return parseCamtFamilyBuffer(buffer, 'CAMT_054')
}
