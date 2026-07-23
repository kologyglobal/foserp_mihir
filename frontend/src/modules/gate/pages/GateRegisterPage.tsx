import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Download, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { Checkbox, Input, Select } from '@/components/forms/Inputs'
import { formatDateTime } from '@/utils/dates/format'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../api/gateService'
import type { GateEntry, GateEntryType, GateLocation } from '../types/gate.types'
import { ENTRY_TYPE_LABELS, todayIsoDate } from '../utils/gateStatus'
import { exportGateCsv } from '../utils/gateExport'
import { GateDataStates, GateStatusBadge, GateTabsStrip, GateQuickEntryDrawer } from '../components'
import { VisitorExitModal } from '../components/VisitorExitModal'
import { VehicleExitModal } from '../components/VehicleExitModal'
import type { GateLoadState } from '../components'
import type { GateVehicle, VisitorVisit } from '../types/gate.types'
import { notify } from '@/store/toastStore'
import { GATE_BREADCRUMB } from '../gateUi'

const TABS: Array<{ id: string; label: string; entryType?: GateEntryType }> = [
  { id: 'all', label: 'All' },
  { id: 'visitor', label: 'Visitors', entryType: 'visitor' },
  { id: 'vehicle', label: 'Vehicles', entryType: 'vehicle' },
  { id: 'material_inward', label: 'Material Inward', entryType: 'material_inward' },
  { id: 'material_outward', label: 'Material Outward', entryType: 'material_outward' },
  { id: 'contractor', label: 'Contractors', entryType: 'contractor' },
  { id: 'courier', label: 'Couriers', entryType: 'courier' },
]

const DETAIL_ROUTES: Record<GateEntryType, string> = {
  visitor: '/gate/visitors',
  vehicle: '/gate/vehicles',
  material_inward: '/gate/material-inward',
  material_outward: '/gate/material-outward',
  contractor: '/gate/contractors',
  courier: '/gate/couriers',
}

/** Today's Gate Register — filters live in the URL so they survive open-record-and-return. */
export function GateRegisterPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') ?? 'all'
  const search = searchParams.get('q') ?? ''
  const date = searchParams.get('date') ?? todayIsoDate()
  const status = searchParams.get('status') ?? ''
  const gate = searchParams.get('gate') ?? ''
  const company = searchParams.get('company') ?? ''
  const insideOnly = searchParams.get('inside') === '1'
  const missingExitOnly = searchParams.get('missingExit') === '1'

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

  const [rows, setRows] = useState<GateEntry[]>([])
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false)
  const [exitVisitor, setExitVisitor] = useState<VisitorVisit | null>(null)
  const [exitVehicle, setExitVehicle] = useState<GateVehicle | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const activeTab = TABS.find((t) => t.id === tab)
      const [data, locs] = await Promise.all([
        gateService.getGateRegister({
          search: search || undefined,
          date: date || undefined,
          status: status || undefined,
          gate: gate || undefined,
          company: company || undefined,
          entryType: activeTab?.entryType ?? '',
          insideOnly: insideOnly || undefined,
          missingExitOnly: missingExitOnly || undefined,
        }),
        gateService.getGateLocations(),
      ])
      setRows(data)
      setLocations(locs)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gate register')
      setState('error')
    }
  }, [tab, search, date, status, gate, company, insideOnly, missingExitOnly])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows])

  const openRecordExit = async (row: GateEntry) => {
    try {
      if (row.entryType === 'visitor') setExitVisitor(await gateService.getVisitorById(row.id))
      else if (row.entryType === 'vehicle') setExitVehicle(await gateService.getVehicleById(row.id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not open exit dialog')
    }
  }

  const exportCsv = () => {
    exportGateCsv(
      `gate-register-${date}.csv`,
      ['Entry No.', 'Time', 'Type', 'Subject', 'Company', 'Purpose', 'Related Document', 'Gate', 'Status', 'Entry By'],
      rows.map((r) => [
        r.entryNumber, formatDateTime(r.time), ENTRY_TYPE_LABELS[r.entryType], r.subject, r.company ?? '',
        r.purpose ?? '', r.relatedDocument ?? '', r.gate, r.status, r.entryBy,
      ]),
    )
    notify.success('Register exported to CSV.')
  }

  if (!perms.canViewRegister) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Today's Gate Register" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view the gate register." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Today's Gate Register"
      description="Every movement through the gates — one operational register."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: "Today's Register" }]}
      favoritePath="/gate/register"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'new-entry', label: 'New Gate Entry', icon: Plus, variant: 'primary', onClick: () => setEntryDrawerOpen(true) }}
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: exportCsv, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <GateTabsStrip tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(id) => setParam('tab', id === 'all' ? '' : id)} />

      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput
          value={search}
          onChange={(v) => setParam('q', v)}
          placeholder="Search entry no., name, vehicle, document…"
          className="w-64"
          aria-label="Search register"
        />
        <Input type="date" value={date} onChange={(e) => setParam('date', e.target.value)} className="w-40" aria-label="Register date" />
        <Select value={status} onChange={(e) => setParam('status', e.target.value)} className="w-44" aria-label="Status filter">
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Select value={gate} onChange={(e) => setParam('gate', e.target.value)} className="w-44" aria-label="Gate filter">
          <option value="">All gates</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </Select>
        <Input
          value={company}
          onChange={(e) => setParam('company', e.target.value)}
          placeholder="Company"
          className="w-40"
          aria-label="Company filter"
        />
        <Checkbox label="Inside only" checked={insideOnly} onChange={(e) => setParam('inside', e.target.checked ? '1' : '')} />
        <Checkbox label="Missing exit only" checked={missingExitOnly} onChange={(e) => setParam('missingExit', e.target.checked ? '1' : '')} />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={ClipboardList}
          emptyTitle="No gate entries for this filter"
          emptyDescription="Try clearing filters or changing the date — new entries appear here as they are captured."
        >
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Entry No.</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Name / Vehicle / Document</th>
                  <th>Company</th>
                  <th>Purpose</th>
                  <th>Related Document</th>
                  <th>Gate</th>
                  <th>Status</th>
                  <th>Entry By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.entryType}-${row.id}`}>
                    <td className="tabular-nums">
                      <TableLink to={`${DETAIL_ROUTES[row.entryType]}/${row.id}`}>{row.entryNumber}</TableLink>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(row.time)}</td>
                    <td>{ENTRY_TYPE_LABELS[row.entryType]}</td>
                    <td className="max-w-[220px] truncate font-medium" title={row.subject}>{row.subject}</td>
                    <td className="max-w-[160px] truncate">{row.company ?? '—'}</td>
                    <td className="max-w-[180px] truncate">{row.purpose ?? '—'}</td>
                    <td className="tabular-nums">{row.relatedDocument ?? '—'}</td>
                    <td>{row.gate}</td>
                    <td>
                      <GateStatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[140px] truncate">{row.entryBy}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <ErpButton size="sm" variant="ghost" onClick={() => navigate(`${DETAIL_ROUTES[row.entryType]}/${row.id}`)}>
                          View
                        </ErpButton>
                        {row.isInside && (row.entryType === 'visitor' || row.entryType === 'vehicle') &&
                        (row.entryType === 'visitor' ? perms.canVisitorExit : perms.canVehicleExit) ? (
                          <ErpButton size="sm" variant="outline" onClick={() => void openRecordExit(row)}>
                            Record Exit
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

      <GateQuickEntryDrawer open={entryDrawerOpen} onClose={() => setEntryDrawerOpen(false)} />
      <VisitorExitModal visit={exitVisitor} onClose={() => setExitVisitor(null)} onDone={() => void load()} />
      <VehicleExitModal vehicle={exitVehicle} onClose={() => setExitVehicle(null)} onDone={() => void load()} />
    </OperationalPageShell>
  )
}
