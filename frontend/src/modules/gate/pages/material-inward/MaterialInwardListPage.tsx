import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, Download, Plus, RefreshCw, ShieldOff } from 'lucide-react'
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
import type { MaterialInwardEntry, MaterialInwardStatus } from '../../types/gate.types'
import { todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateBoundaryBanner, GateDataStates, GateStatusBadge, GateTabsStrip, InsideDuration } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS: Array<{ id: string; label: string; statuses?: MaterialInwardStatus[] }> = [
  { id: 'all', label: 'All' },
  { id: 'waiting_unloading', label: 'Waiting for Unloading', statuses: ['waiting_unloading'] },
  { id: 'waiting_store', label: 'Waiting for Store', statuses: ['waiting_store'] },
  { id: 'waiting_qc', label: 'Waiting for QC', statuses: ['waiting_qc'] },
  { id: 'waiting_grn', label: 'Waiting for GRN', statuses: ['waiting_grn'] },
  { id: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { id: 'closed', label: 'Closed', statuses: ['closed'] },
]

export function MaterialInwardListPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const search = searchParams.get('q') ?? ''
  const [rows, setRows] = useState<MaterialInwardEntry[]>([])
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
      const all = await gateService.getMaterialInwardEntries({ search: search || undefined })
      const active = TABS.find((t) => t.id === tab)
      const filtered = active?.statuses ? all.filter((r) => active.statuses!.includes(r.status)) : all
      setRows(filtered)
      setState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load material inward')
      setState('error')
    }
  }, [tab, search])

  useEffect(() => { void load() }, [load])

  if (!perms.canViewInward) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Material Inward" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view material inward." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Material Inward"
      description="Physical arrival register — inventory posts only after Store completes the GRN."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Inward' }]}
      favoritePath="/gate/material-inward"
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={perms.canCreateInward ? { id: 'new', label: 'New Inward', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/material-inward/new') } : undefined}
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: () => {
              exportGateCsv(`material-inward-${todayIsoDate()}.csv`,
                ['Gate Entry No.', 'Arrival', 'Vendor', 'PO / Challan', 'Vehicle', 'Material', 'Packages', 'Warehouse', 'Status'],
                rows.map((r) => [r.entryNumber, r.arrivalTime ? formatDateTime(r.arrivalTime) : '', r.vendorName ?? '', r.poNumber ?? r.challanNumber ?? '', r.vehicleNumber ?? '', r.materialSummary, r.packages, r.warehouse ?? '', r.status]))
              notify.success('Inward register exported.')
            }, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="px-3 pt-3"><GateBoundaryBanner message="Gate entry records physical material arrival only. Inventory will be updated after Store completes the GRN." /></div>
      <GateTabsStrip tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(id) => setParam('tab', id === 'all' ? '' : id)} />
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search entry no., vendor, PO, vehicle…" className="w-72" aria-label="Search inward" />
      </div>
      <div className="p-3">
        <GateDataStates state={state} error={error} onRetry={() => void load()} emptyIcon={ArrowDownToLine} emptyTitle="No material inward records" emptyDescription="Register a physical arrival when a vehicle reaches the gate." emptyAction={perms.canCreateInward ? <ErpButton size="sm" onClick={() => navigate('/gate/material-inward/new')}>New Inward</ErpButton> : undefined}>
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Gate Entry No.</th><th>Arrival Time</th><th>Vendor</th><th>PO / Challan</th><th>Vehicle No.</th>
                  <th>Material Summary</th><th>Packages</th><th>Warehouse</th><th>Status</th><th>Waiting Time</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums"><TableLink to={`/gate/material-inward/${r.id}`}>{r.entryNumber}</TableLink></td>
                    <td className="whitespace-nowrap">{r.arrivalTime ? formatDateTime(r.arrivalTime) : '—'}</td>
                    <td className="max-w-[150px] truncate">{r.vendorName ?? '—'}</td>
                    <td className="tabular-nums">{r.poNumber ?? r.challanNumber ?? '—'}</td>
                    <td className="tabular-nums">{r.vehicleNumber ?? '—'}</td>
                    <td className="max-w-[220px] truncate font-medium">{r.materialSummary}</td>
                    <td className="tabular-nums">{r.packages}</td>
                    <td>{r.warehouse ?? '—'}</td>
                    <td><GateStatusBadge status={r.status} /></td>
                    <td><InsideDuration from={r.arrivalTime} warnAfterMinutes={60} /></td>
                    <td><ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/material-inward/${r.id}`)}>View</ErpButton></td>
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
