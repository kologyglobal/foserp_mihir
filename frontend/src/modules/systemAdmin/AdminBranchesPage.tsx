import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Network, RefreshCw } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminNeedsAttention,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  type AdminAttentionItem,
} from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { Badge } from '../../components/ui/Badge'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { listBranches } from '../../services/bridges/financeApiBridge'
import type { Branch } from '../../types/financeSetup'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { useFinancePermissions } from '../../utils/permissions/finance'

/**
 * Admin Branches entry — Branch SoT via finance branch APIs (LegalEntity-owned).
 * Full create/edit remains on Accounting → Settings → Branches.
 */
export function AdminBranchesPage() {
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listBranches())
    } catch (err) {
      const msg = formatApiError(err)
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
    else setLoading(false)
  }, [load, perms.canView])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length
    const defaults = rows.filter((r) => r.isDefault).length
    const factories = rows.filter((r) => r.branchType === 'FACTORY').length
    return { total: rows.length, active, defaults, factories }
  }, [rows])

  const attention = useMemo((): AdminAttentionItem[] => {
    const items: AdminAttentionItem[] = []
    if (rows.length === 0) {
      items.push({
        id: 'no-branch',
        title: 'No branches configured',
        detail: 'Create at least a Head Office branch under Accounting settings.',
        severity: 'warning',
        to: '/accounting/settings/branches',
      })
    }
    if (rows.length > 0 && stats.defaults === 0) {
      items.push({
        id: 'no-default-branch',
        title: 'No default branch',
        detail: 'Set a default branch for posting and inventory context.',
        severity: 'info',
        to: '/accounting/settings/branches',
      })
    }
    return items
  }, [rows, stats])

  return (
    <AdminWorkspaceShell
      title="Branches"
      description="Operating locations under legal entities — same Branch master as finance settings."
      workspace="organization"
      favoritePath="/admin/branches"
      pageGuide={{
        purpose: 'Admin entry for branches. SoT is the finance Branch API under Legal Entity.',
        nextStep: 'Open Accounting → Branches to create, activate, or set default.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'manage-accounting',
            label: 'Manage in Accounting',
            icon: Network,
            onClick: () => navigate('/accounting/settings/branches'),
          }}
          secondaryActions={[
            {
              id: 'companies',
              label: 'Companies',
              icon: Building2,
              onClick: () => navigate('/admin/companies'),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        {!perms.canView ? (
          <AdminEmptyState
            title="No access"
            description="You need finance view permissions to list branches."
          />
        ) : loading ? (
          <AdminSkeleton rows={5} />
        ) : error ? (
          <AdminErrorState title="Could not load branches" description={error} />
        ) : (
          <>
            <AdminSummaryStrip>
              <AdminSummaryCard label="Branches" value={stats.total} icon={Network} accent="blue" />
              <AdminSummaryCard label="Active" value={stats.active} accent="green" />
              <AdminSummaryCard label="Factories" value={stats.factories} accent="amber" />
              <AdminSummaryCard label="Default" value={stats.defaults} accent="slate" />
            </AdminSummaryStrip>

            <AdminNeedsAttention items={attention} title="Branch setup" />

            <section className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
              <header className="border-b border-erp-border px-4 py-3">
                <h2 className="text-sm font-semibold text-erp-text">Branch register</h2>
                <p className="text-xs text-erp-muted">Source: finance branches API</p>
              </header>
              {rows.length === 0 ? (
                <AdminEmptyState
                  title="No branches yet"
                  description="Create branches under Accounting settings after the legal entity exists."
                  action={
                    <ErpButton size="sm" type="button" onClick={() => navigate('/accounting/settings/branches')}>
                      Open Branches
                    </ErpButton>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-erp-surface-alt text-xs uppercase tracking-wide text-erp-muted">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Code</th>
                        <th className="px-4 py-2 font-semibold">Name</th>
                        <th className="px-4 py-2 font-semibold">Type</th>
                        <th className="px-4 py-2 font-semibold">GSTIN</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-erp-border">
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer hover:bg-erp-surface-alt/60"
                          onClick={() => navigate('/accounting/settings/branches')}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs">{row.code}</td>
                          <td className="px-4 py-2.5 font-medium text-erp-text">
                            {row.name}
                            {row.isDefault ? (
                              <Badge color="blue" className="ml-2">
                                Default
                              </Badge>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-erp-muted">{row.branchType.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{row.gstin ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <Badge color={row.isActive ? 'green' : 'gray'}>{row.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  )
}
