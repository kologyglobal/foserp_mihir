import type { BankConnectorAdapter, BankConnectorAdapterContext } from '../bank-connector.interface.js'
import type { BankConnectorProviderCode } from '../bank-connector.enums.js'

function notImplementedAdapter(providerCode: BankConnectorProviderCode): BankConnectorAdapter {
  return {
    providerCode,
    async testConnection(_ctx: BankConnectorAdapterContext) {
      return {
        ok: false as const,
        code: 'NOT_IMPLEMENTED' as const,
        message: `Provider ${providerCode} is not implemented for live pull yet (OPEN_BANKING / PSD2 OAuth deferred).`,
      }
    },
    // Intentionally omit listRemoteFiles / fetchStatementFile so sync → NOT_IMPLEMENTED.
  }
}

export const manualFileAdapter = notImplementedAdapter('MANUAL_FILE')
export const genericRestAdapter = notImplementedAdapter('GENERIC_REST')
export const mt940SftpAdapter = notImplementedAdapter('MT940_SFTP')
export const camtSftpAdapter = notImplementedAdapter('CAMT_SFTP')
export const openBankingAdapter = notImplementedAdapter('OPEN_BANKING')

export const stubAdaptersByProvider: Record<BankConnectorProviderCode, BankConnectorAdapter> = {
  MANUAL_FILE: manualFileAdapter,
  GENERIC_REST: genericRestAdapter,
  MT940_SFTP: mt940SftpAdapter,
  CAMT_SFTP: camtSftpAdapter,
  OPEN_BANKING: openBankingAdapter,
}
