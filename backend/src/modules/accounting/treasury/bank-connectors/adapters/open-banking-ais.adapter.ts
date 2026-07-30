/**
 * Phase 5D4 — Open Banking AIS adapter.
 *
 * Default provider mode is SIMULATED (env BANK_CONNECTOR_AIS_PROVIDER), same precedent as
 * GST NIC e-invoice / e-Way (`GST_NIC_PROVIDER=SIMULATED`): pull MT940/CAMT from an allow-listed
 * sandbox filesystem drop folder after consent is AUTHORIZED.
 *
 * LIVE TPP / production bank AIS download remains NOT_IMPLEMENTED until a real bank integration
 * is configured.
 */
import { createSandboxFsAdapter } from './sandbox-fs.adapter.js'
import { notImplementedAdapter } from './not-implemented.adapter.js'
import {
  isSandboxConnectorsEnabled,
} from '../bank-connector.secrets.js'
import type { BankConnectorAdapter, BankConnectorAdapterContext } from '../bank-connector.interface.js'
import type { BankConnectorConfigJson } from '../bank-connector.types.js'

export type AisProviderMode = 'SIMULATED' | 'LIVE'

export function getAisProviderMode(): AisProviderMode {
  const raw = (process.env.BANK_CONNECTOR_AIS_PROVIDER ?? 'SIMULATED').trim().toUpperCase()
  return raw === 'LIVE' ? 'LIVE' : 'SIMULATED'
}

export function wantsSimulatedAis(config: BankConnectorConfigJson | null): boolean {
  if (getAisProviderMode() === 'LIVE') return false
  if (!config) return true
  if (config.mode === 'LIVE') return false
  // SANDBOX and SIMULATED (and unset) → simulated AIS drop-folder pull
  return true
}

function createSimulatedAisAdapter(): BankConnectorAdapter {
  const fsAdapter = createSandboxFsAdapter('OPEN_BANKING')
  return {
    providerCode: 'OPEN_BANKING',
    async testConnection(ctx: BankConnectorAdapterContext) {
      if (!isSandboxConnectorsEnabled()) {
        return {
          ok: false as const,
          code: 'NOT_CONFIGURED' as const,
          message:
            'SIMULATED AIS requires BANK_CONNECTOR_SANDBOX_ENABLED=true and a sandboxRoot drop folder',
        }
      }
      const root = typeof ctx.configJson?.sandboxRoot === 'string' ? ctx.configJson.sandboxRoot.trim() : ''
      if (!root) {
        return {
          ok: false as const,
          code: 'NOT_CONFIGURED' as const,
          message:
            'SIMULATED AIS requires configJson.sandboxRoot (MT940/CAMT drop folder). Live bank AIS is deferred.',
        }
      }
      const result = await fsAdapter.testConnection(ctx)
      if (!result.ok) return result
      return {
        ok: true as const,
        code: 'OK' as const,
        message: `SIMULATED AIS reachable (sandbox drop folder). Live TPP AIS still deferred.`,
      }
    },
    listRemoteFiles: (ctx) => fsAdapter.listRemoteFiles!(ctx),
    fetchStatementFile: (ctx, remotePath) => fsAdapter.fetchStatementFile!(ctx, remotePath),
  }
}

/** Resolve OPEN_BANKING adapter: SIMULATED drop-folder AIS or LIVE stub. */
export function resolveOpenBankingAisAdapter(
  config: BankConnectorConfigJson | null,
): BankConnectorAdapter {
  if (!wantsSimulatedAis(config)) {
    return notImplementedAdapter('OPEN_BANKING')
  }
  return createSimulatedAisAdapter()
}
