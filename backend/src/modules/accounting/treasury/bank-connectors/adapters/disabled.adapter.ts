import type { BankConnectorAdapter, BankConnectorAdapterContext } from '../bank-connector.interface.js'

/** Always reports PROVIDER_DISABLED — used when connector status is DISABLED. */
export const disabledAdapter: BankConnectorAdapter = {
  providerCode: 'DISABLED',
  async testConnection(_ctx: BankConnectorAdapterContext) {
    return {
      ok: false as const,
      code: 'PROVIDER_DISABLED' as const,
      message: 'Bank connector is disabled. Enable it, then run Test connection / Sync.',
    }
  },
}
