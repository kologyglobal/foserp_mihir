import { parseCamtFamilyBuffer, assertSafeCamtXml } from './bank-statement-camt-common.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'

/**
 * ISO 20022 CAMT.053 (BankToCustomerStatement) → normalised header + lines.
 */
export function parseCamt053Buffer(buffer: Buffer): NativeStatementParseResult {
  return parseCamtFamilyBuffer(buffer, 'CAMT_053')
}

export { assertSafeCamtXml }
