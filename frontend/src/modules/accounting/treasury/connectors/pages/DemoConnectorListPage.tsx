import { PlugZap, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { notify } from '@/store/toastStore'
import { useTreasuryConnectorPermissions } from '@/utils/permissions/treasuryConnector'
import { PROVIDER_LABELS } from '../api/bank-connector.types'
import { ConnectorWorkspaceShell } from '../components/ConnectorWorkspaceShell'
import { seedDemoBankConnectors } from '../demo/seedDemoBankConnectors'

/** Demo-mode list — seeded disabled connectors; Test/Sync never pretend success. */
export function DemoConnectorListPage() {
  const perms = useTreasuryConnectorPermissions()
  const [items] = useState(() => seedDemoBankConnectors())
  const rows = useMemo(() => items, [items])

  if (!perms.canView) {
    return (
      <ConnectorWorkspaceShell title="Bank connectors (scaffold)">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank connectors.</p>
      </ConnectorWorkspaceShell>
    )
  }

  return (
    <ConnectorWorkspaceShell title="Bank connectors (scaffold)">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
        Phase 5D1 scaffold — live bank APIs not connected. Demo seed shows Disabled / Coming soon connectors only.
      </div>

      <EnterpriseRegisterTableShell>
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-erp-border bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Code</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Provider</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Connection</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-erp-border/70">
                <td className="px-3 py-2 font-medium">{row.code}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{PROVIDER_LABELS[row.provider]}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-erp-muted">{row.connectionLabel} / Coming soon</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <ErpButton
                      size="sm"
                      variant="secondary"
                      icon={PlugZap}
                      onClick={() => notify.info('Provider is not implemented yet (Coming soon)')}
                    >
                      Test
                    </ErpButton>
                    <ErpButton
                      size="sm"
                      variant="secondary"
                      icon={RefreshCw}
                      onClick={() => notify.info('Sync is not implemented yet — no statements created')}
                    >
                      Sync
                    </ErpButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </EnterpriseRegisterTableShell>
    </ConnectorWorkspaceShell>
  )
}
