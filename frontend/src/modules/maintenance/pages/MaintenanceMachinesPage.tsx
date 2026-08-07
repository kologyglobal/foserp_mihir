import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cog, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Input } from '@/components/forms/Inputs'
import { listAllMachines } from '@/services/api/manufacturingApi'
import { notify } from '@/store/toastStore'
import type { Machine } from '@/types/manufacturingSetup'
import { MAINTENANCE_BREADCRUMB } from '../maintenanceUi'

/** Pick a machine → open Maintenance History. */
export function MaintenanceMachinesPage() {
  const [rows, setRows] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listAllMachines({ isActive: true }))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load machines')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(
        (m) =>
          m.code.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          (m.status ?? '').toLowerCase().includes(q),
      )
    : rows

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Machine History"
      description="Select a machine to view breakdown tickets, downtime, and repair cost."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Machine History' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/machines"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-4 max-w-sm">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search machine code or name" />
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Cog} title="No machines" description="No active machines found for this tenant." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">History</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-erp-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-erp-primary">{m.code}</div>
                    <div className="text-erp-fg">{m.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusDot
                      label={(m.status ?? '-').replace(/_/g, ' ')}
                      tone={
                        m.status === 'AVAILABLE'
                          ? 'success'
                          : m.status === 'OUT_OF_SERVICE' || m.status === 'UNDER_MAINTENANCE'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/maintenance/machines/${m.id}/history`} className="text-erp-primary hover:underline">
                      View history
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}
