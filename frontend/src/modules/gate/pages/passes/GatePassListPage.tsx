import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GatePass, GatePassStatus } from '../../types/gate.types'
import { gatePassPendingQty, isGatePassOverdue, todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateDataStates, GateStatusBadge, GateTabsStrip, OverdueIndicator } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS: Array<{ id: string; label: string; statuses?: GatePassStatus[] }> = [
  { id: 'all', label: 'All' },
  { id: 'pending_approval', label: 'Awaiting Approval', statuses: ['pending_approval'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'sent_out', label: 'Sent Out', statuses: ['sent_out'] },
  { id: 'partially_returned', label: 'Partially Returned', statuses: ['partially_returned'] },
  { id: 'returned', label: 'Returned', statuses: ['returned'] },
  { id: 'overdue', label: 'Overdue', statuses: ['overdue'] },
  { id: 'closed', label: 'Closed', statuses: ['closed', 'written_off'] },
]

export function GatePassListPage({ initialTab }: { initialTab?: string }) {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? initialTab ?? 'all'
  const search = searchParams.get('q') ?? ''
  const [rows, setRows] = useState<GatePass[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')

  const setParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const all = await gateService.getGatePasses({ search: search || undefined })
      let filtered = all
      if (tab === 'overdue') filtered = all.filter((p) => isGatePassOverdue(p) || p.status === 'overdue')
      else {
        const active = TABS.find((t) => t.id === tab)
        if (active?.statuses) filtered = all.filter((p) => active.statuses!.includes(p.status))
      }
      setRows(filtered)
      setState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gate passes')
      setState('error')
    }
  }, [tab, search])

  useEffect(() => { void load() }, [load])

  if (!perms.canViewPass) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Gate Passes" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view gate passes." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security" title="Gate Passes"
      description="Returnable and non-returnable physical item movement — no accounting vouchers."
      showDescription autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Gate Passes' }]}
      favoritePath="/gate/passes"
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={perms.canCreatePass ? { id: 'new', label: 'New Gate Pass', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/passes/new') } : undefined}
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: () => {
              exportGateCsv(`gate-passes-${todayIsoDate()}.csv`,
                ['Pass No.', 'Type', 'Item', 'Qty', 'Carried By', 'Department', 'Outward', 'Expected Return', 'Pending', 'Status'],
                rows.map((p) => [p.entryNumber, p.passKind, p.items[0]?.itemDescription ?? '', p.items.reduce((s, i) => s + i.quantity, 0), p.carriedBy, p.department, formatDate(p.outwardDate), p.expectedReturnDate ? formatDate(p.expectedReturnDate) : '', gatePassPendingQty(p), p.status]))
              notify.success('Gate pass register exported.')
            }, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <GateTabsStrip tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(id) => setParam('tab', id === 'all' ? '' : id)} />
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search pass no., item, employee, party…" className="w-72" aria-label="Search gate passes" />
      </div>
      <div className="p-3">
        <GateDataStates state={state} error={error} onRetry={() => void load()} emptyIcon={FileText} emptyTitle="No gate passes for this filter" emptyDescription="Create a returnable or non-returnable pass for physical item movement." emptyAction={perms.canCreatePass ? <ErpButton size="sm" onClick={() => navigate('/gate/passes/new')}>New Gate Pass</ErpButton> : undefined}>
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Pass No.</th><th>Pass Type</th><th>Item</th><th>Quantity</th><th>Carried By</th>
                  <th>Department</th><th>Outward Date</th><th>Expected Return</th><th>Pending Quantity</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const overdue = isGatePassOverdue(p) || p.status === 'overdue'
                  return (
                    <tr key={p.id} className={overdue ? 'bg-rose-50/50' : undefined}>
                      <td className="tabular-nums">
                        <TableLink to={`/gate/passes/${p.id}`}>{p.entryNumber}</TableLink>
                        {overdue ? <div className="mt-0.5"><OverdueIndicator /></div> : null}
                      </td>
                      <td className="capitalize">{p.passKind.replace(/_/g, ' ')}</td>
                      <td className="max-w-[200px] truncate font-medium">{p.items[0]?.itemDescription ?? '—'}{p.items.length > 1 ? ` (+${p.items.length - 1})` : ''}</td>
                      <td className="tabular-nums">{p.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td>{p.carriedBy}</td>
                      <td>{p.department}</td>
                      <td>{formatDate(p.outwardDate)}</td>
                      <td>{p.expectedReturnDate ? formatDate(p.expectedReturnDate) : '—'}</td>
                      <td className="tabular-nums font-semibold">{gatePassPendingQty(p)}</td>
                      <td><GateStatusBadge status={overdue && p.status !== 'overdue' ? 'overdue' : p.status} /></td>
                      <td><ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/passes/${p.id}`)}>View</ErpButton></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>
    </OperationalPageShell>
  )
}
