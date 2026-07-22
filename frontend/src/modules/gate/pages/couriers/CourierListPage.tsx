import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Hand, Package, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { CourierEntry } from '../../types/gate.types'
import { todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateDataStates, GateStatusBadge, GateTabsStrip } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS = [
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'pending_handover', label: 'Pending Handover' },
  { id: 'delivered', label: 'Delivered' },
] as const

type CourierTab = (typeof TABS)[number]['id']

function tabFilter(tab: CourierTab, row: CourierEntry): boolean {
  if (tab === 'incoming') return row.direction === 'incoming'
  if (tab === 'outgoing') return row.direction === 'outgoing'
  if (tab === 'pending_handover') return row.status === 'pending_handover'
  if (tab === 'delivered') return row.status === 'handed_over' || row.status === 'delivered'
  return true
}

export function CourierListPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as CourierTab | null) ?? 'incoming'
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

  const [allRows, setAllRows] = useState<CourierEntry[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const data = await gateService.getCouriers({ search: search || undefined })
      setAllRows(data)
      const filtered = data.filter((r) => tabFilter(tab, r))
      setState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load couriers')
      setState('error')
    }
  }, [search, tab])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => allRows.filter((r) => tabFilter(tab, r)), [allRows, tab])

  const counts = useMemo(
    () => ({
      pendingHandover: allRows.filter((r) => r.status === 'pending_handover').length,
    }),
    [allRows],
  )

  const handover = async (row: CourierEntry) => {
    const receiver = await appPromptNote({
      title: 'Hand over parcel',
      description: `${row.entryNumber} · ${row.courierCompany}${row.trackingNumber ? ` · ${row.trackingNumber}` : ''}`,
      confirmLabel: 'Confirm Handover',
      note: { required: true, label: 'Handed over to', rows: 1 },
    })
    if (receiver == null) return
    try {
      await gateService.markCourierHandedOver(row.id, receiver)
      notify.success('Parcel handed over.')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Handover failed')
    }
  }

  const exportCsv = () => {
    exportGateCsv(
      `couriers-${todayIsoDate()}.csv`,
      ['Entry No.', 'Direction', 'Courier', 'Tracking', 'Sender', 'Recipient', 'Department', 'Status', 'Received / Dispatch'],
      rows.map((r) => [
        r.entryNumber,
        r.direction,
        r.courierCompany,
        r.trackingNumber ?? '',
        r.senderName ?? '',
        r.recipientEmployee ?? '',
        r.department ?? '',
        r.status,
        r.receivedTime ? formatDateTime(r.receivedTime) : r.dispatchTime ? formatDateTime(r.dispatchTime) : '',
      ]),
    )
    notify.success('Courier register exported.')
  }

  if (!perms.canViewCourier) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Couriers" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view courier records." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Courier Register"
      description="Incoming and outgoing parcels with handover tracking at the gate."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Couriers' }]}
      favoritePath="/gate/couriers"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateCourier
              ? { id: 'new', label: 'New Courier Entry', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/couriers/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: exportCsv, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <GateTabsStrip
        tabs={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: t.id === 'pending_handover' && tab !== 'pending_handover' ? counts.pendingHandover || undefined : undefined,
        }))}
        active={tab}
        onChange={(id) => setParam('tab', id === 'incoming' ? '' : id)}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput
          value={search}
          onChange={(v) => setParam('q', v)}
          placeholder="Search entry no., courier, tracking, sender, recipient…"
          className="w-72"
          aria-label="Search couriers"
        />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={Package}
          emptyTitle="No courier records for this tab"
          emptyDescription="Register incoming or outgoing parcels at the gate."
          emptyAction={
            perms.canCreateCourier ? (
              <ErpButton size="sm" onClick={() => navigate('/gate/couriers/new')}>
                New Courier Entry
              </ErpButton>
            ) : undefined
          }
        >
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Entry No.</th>
                  <th>Courier</th>
                  <th>Tracking</th>
                  <th>Sender</th>
                  <th>Recipient</th>
                  <th>Department</th>
                  <th>Parcel</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums">
                      <TableLink to={`/gate/couriers/${r.id}`}>{r.entryNumber}</TableLink>
                    </td>
                    <td className="font-medium">{r.courierCompany}</td>
                    <td className="tabular-nums">{r.trackingNumber ?? '—'}</td>
                    <td>{r.senderName ?? '—'}</td>
                    <td>{r.recipientEmployee ?? '—'}</td>
                    <td>{r.department ?? '—'}</td>
                    <td className="max-w-[160px] truncate">{r.parcelType ?? r.parcelDescription ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {r.receivedTime ? formatDateTime(r.receivedTime) : r.dispatchTime ? formatDateTime(r.dispatchTime) : '—'}
                    </td>
                    <td>
                      <GateStatusBadge status={r.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/couriers/${r.id}`)}>
                          View
                        </ErpButton>
                        {r.status === 'pending_handover' && r.direction === 'incoming' && perms.canCourierHandover ? (
                          <ErpButton size="sm" variant="outline" icon={Hand} onClick={() => void handover(r)}>
                            Handover
                          </ErpButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>
    </OperationalPageShell>
  )
}
