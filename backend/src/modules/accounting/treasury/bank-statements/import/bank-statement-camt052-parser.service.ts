import { parseCamtFamilyBuffer } from './bank-statement-camt-common.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'

/** ISO 20022 CAMT.052 (BankToCustomerAccountReport) — provisional intraday. */
export function parseCamt052Buffer(buffer: Buffer): NativeStatementParseResult {
  return parseCamtFamilyBuffer(buffer, 'CAMT_052')
}
