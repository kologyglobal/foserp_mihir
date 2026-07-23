import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Download, Plus, RefreshCw, ShieldOff, Users } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { ExpectedVisitor, VisitorVisit } from '../../types/gate.types'
import { VISITOR_TYPE_LABELS, todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateDataStates, GateStatusBadge, GateTabsStrip } from '../../components'
import { VisitorExitModal } from '../../components/VisitorExitModal'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS = [
  { id: 'all', label: 'All Visitors' },
  { id: 'expected', label: 'Expected Today' },
  { id: 'inside', label: 'Currently Inside' },
  { id: 'exited', label: 'Exited' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'no_show', label: 'No Show' },
] as const

type VisitorTab = (typeof TABS)[number]['id']

export function VisitorsListPage({ initialTab }: { initialTab?: VisitorTab }) {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as VisitorTab | null) ?? initialTab ?? 'all'
  const search = searchParams.get('q') ?? ''

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [visits, setVisits] = useState<VisitorVisit[]>([])
  const [expected, setExpected] = useState<ExpectedVisitor[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [exitVisitor, setExitVisitor] = useState<VisitorVisit | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      if (tab === 'expected') {
        const rows = await gateService.getExpectedVisitors({ search: search || undefined, date: todayIsoDate(), status: 'expected' })
        setExpected(rows)
        setState(rows.length === 0 ? 'empty' : 'ready')
      } else {
        const status = tab === 'all' ? undefined : tab
        const rows = await gateService.getVisitors({ search: search || undefined, status })
        setVisits(rows)
        setState(rows.length === 0 ? 'empty' : 'ready')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visitors')
      setState('error')
    }
  }, [tab, search])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => ({ inside: visits.filter((v) => v.status === 'inside').length }), [visits])

  const exportCsv = () => {
    exportGateCsv(
      `visitors-${todayIsoDate()}.csv`,
      ['Pass No.', 'Visitor', 'Mobile', 'Company', 'Type', 'Person to Meet', 'Purpose', 'Entry Time', 'Exit Time', 'Status'],
      visits.map((v) => [
        v.entryNumber, v.visitorName, v.mobile, v.company ?? '', VISITOR_TYPE_LABELS[v.visitorType], v.hostName,
        v.purpose, v.entryTime ? formatDateTime(v.entryTime) : '', v.exitTime ? formatDateTime(v.exitTime) : '', v.status,
      ]),
    )
    notify.success('Visitor register exported.')
  }

  if (!perms.canViewVisitor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Visitors" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view visitor records." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Visitor Management"
      description="Expected, inside and completed visits — search-first, exit-safe."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Visitors' }]}
      favoritePath="/gate/visitors"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateVisitor
              ? { id: 'new', label: 'New Visitor Entry', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/visitors/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'expected', label: 'Pre-register Visitor', icon: CalendarPlus, onClick: () => navigate('/gate/visitors/expected'), hidden: !perms.canCreateVisitor },
            { id: 'export', label: 'Export CSV', icon: Download, onClick: exportCsv, disabled: tab === 'expected' || visits.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <GateTabsStrip
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === 'inside' && tab !== 'inside' ? counts.inside || undefined : undefined }))}
        active={tab}
        onChange={(id) => setParam('tab', id === 'all' ? '' : id)}
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search pass no., name, mobile, company, host…" className="w-72" aria-label="Search visitors" />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={Users}
          emptyTitle={tab === 'expected' ? 'No expected visitors today' : 'No visitors for this filter'}
          emptyDescription={tab === 'expected' ? 'Pre-register visitors so the gate can check them in quickly.' : 'Adjust the search or tab to see more records.'}
          emptyAction={
            perms.canCreateVisitor ? (
              <ErpButton size="sm" onClick={() => navigate(tab === 'expected' ? '/gate/visitors/expected' : '/gate/visitors/new')}>
                {tab === 'expected' ? 'Pre-register Visitor' : 'New Visitor Entry'}
              </ErpButton>
            ) : undefined
          }
        >
          <EnterpriseRegisterTableShell>
            {tab === 'expected' ? (
              <table className="erp-table w-full text-[12.5px]">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Visitor</th>
                    <th>Mobile</th>
                    <th>Company</th>
                    <th>Expected Arrival</th>
                    <th>Host</th>
                    <th>Purpose</th>
                    <th>Gate</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expected.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular-nums">{row.reference}</td>
                      <td className="font-medium">{row.visitorName}</td>
                      <td className="tabular-nums">{row.mobile}</td>
                      <td>{row.company ?? '—'}</td>
                      <td>{row.expectedArrival}</td>
                      <td>{row.hostName}</td>
                      <td className="max-w-[200px] truncate">{row.purpose}</td>
                      <td>{row.gate}</td>
                      <td>
                        {perms.canCreateVisitor ? (
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/gate/visitors/new?expectedId=${row.id}`)}>
                            Mark Arrived
                          </ErpButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="erp-table w-full text-[12.5px]">
                <thead>
                  <tr>
                    <th>Pass No.</th>
                    <th>Visitor</th>
                    <th>Mobile</th>
                    <th>Company</th>
                    <th>Visitor Type</th>
                    <th>Person to Meet</th>
                    <th>Purpose</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td className="tabular-nums">
                        <TableLink to={`/gate/visitors/${v.id}`}>{v.entryNumber}</TableLink>
                      </td>
                      <td className="font-medium">{v.visitorName}</td>
                      <td className="tabular-nums">{v.mobile}</td>
                      <td className="max-w-[150px] truncate">{v.company ?? '—'}</td>
                      <td>{VISITOR_TYPE_LABELS[v.visitorType]}</td>
                      <td>{v.hostName}</td>
                      <td className="max-w-[180px] truncate">{v.purpose}</td>
                      <td className="whitespace-nowrap">{v.entryTime ? formatDateTime(v.entryTime) : '—'}</td>
                      <td className="whitespace-nowrap">{v.exitTime ? formatDateTime(v.exitTime) : '—'}</td>
                      <td>
                        <GateStatusBadge status={v.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/visitors/${v.id}`)}>
                            View
                          </ErpButton>
                          {v.status === 'inside' && perms.canVisitorExit ? (
                            <ErpButton size="sm" variant="outline" onClick={() => setExitVisitor(v)}>
                              Record Exit
                            </ErpButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>

      <VisitorExitModal visit={exitVisitor} onClose={() => setExitVisitor(null)} onDone={() => void load()} />
    </OperationalPageShell>
  )
}
