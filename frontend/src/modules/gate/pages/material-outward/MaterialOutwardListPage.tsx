import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpFromLine, Download, RefreshCw, ScanSearch, ShieldOff } from 'lucide-react'
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
import type { MaterialOutwardEntry, MaterialOutwardStatus } from '../../types/gate.types'
import { todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateBoundaryBanner, GateDataStates, GateStatusBadge, GateTabsStrip } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS: Array<{ id: string; label: string; statuses?: MaterialOutwardStatus[] }> = [
  { id: 'awaiting_vehicle', label: 'Awaiting Vehicle', statuses: ['awaiting_vehicle'] },
  { id: 'pending_approval', label: 'Waiting for Approval', statuses: ['pending_approval'] },
  { id: 'ready_for_gate', label: 'Ready for Gate', statuses: ['ready_for_gate'] },
  { id: 'vehicle_inside', label: 'Vehicle Inside', statuses: ['vehicle_inside'] },
  { id: 'held', label: 'Held', statuses: ['held'] },
  { id: 'released', label: 'Released', statuses: ['released'] },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

export function MaterialOutwardListPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'ready_for_gate'
  const search = searchParams.get('q') ?? ''
  const [rows, setRows] = useState<MaterialOutwardEntry[]>([])
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
      const all = await gateService.getMaterialOutwardEntries({ search: search || undefined })
      const active = TABS.find((t) => t.id === tab)
      const filtered = active?.statuses ? all.filter((r) => active.statuses!.includes(r.status)) : all
      setRows(filtered)
      setState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load material outward')
      setState('error')
    }
  }, [tab, search])

  useEffect(() => { void load() }, [load])

  if (!perms.canViewOutward) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Material Outward" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view material outward." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security" title="Material Outward"
      description="Verify approved documents and release vehicles — no stock or accounting posting here."
      showDescription autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Outward' }]}
      favoritePath="/gate/material-outward"
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={perms.canVerifyOutward ? { id: 'verify', label: 'Verify & Release', icon: ScanSearch, variant: 'primary', onClick: () => navigate('/gate/material-outward/verify') } : undefined}
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: () => {
              exportGateCsv(`material-outward-${todayIsoDate()}.csv`,
                ['Outward No.', 'Document', 'Party', 'Vehicle', 'Material', 'Packages', 'Approval', 'Status', 'Planned'],
                rows.map((r) => [r.entryNumber, `${r.documentType} ${r.documentNumber}`, r.partyName ?? '', r.vehicleNumber ?? '', r.materialSummary, r.packagesExpected, r.approvalStatus, r.status, r.plannedTime ? formatDateTime(r.plannedTime) : '']))
              notify.success('Outward register exported.')
            }, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="px-3 pt-3">
        <GateBoundaryBanner message="Security verifies and releases approved outward material. Stock and accounting posting remain in their respective modules." />
      </div>
      <GateTabsStrip tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(id) => setParam('tab', id)} />
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search outward no., document, vehicle, party…" className="w-72" aria-label="Search outward" />
      </div>
      <div className="p-3">
        <GateDataStates state={state} error={error} onRetry={() => void load()} emptyIcon={ArrowUpFromLine} emptyTitle="No outward records for this filter" emptyDescription="Use Verify & Release to find an approved document at the gate." emptyAction={perms.canVerifyOutward ? <ErpButton size="sm" onClick={() => navigate('/gate/material-outward/verify')}>Verify & Release</ErpButton> : undefined}>
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Outward No.</th><th>Document Type</th><th>Customer / Vendor</th><th>Vehicle No.</th>
                  <th>Material Summary</th><th>Packages</th><th>Approval</th><th>Release Status</th><th>Planned Time</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums"><TableLink to={`/gate/material-outward/${r.id}`}>{r.entryNumber}</TableLink></td>
                    <td>{r.documentType}</td>
                    <td className="max-w-[160px] truncate">{r.partyName ?? '—'}</td>
                    <td className="tabular-nums">{r.vehicleNumber ?? '—'}</td>
                    <td className="max-w-[220px] truncate font-medium">{r.materialSummary}</td>
                    <td className="tabular-nums">{r.packagesExpected}</td>
                    <td><GateStatusBadge status={r.approvalStatus} /></td>
                    <td><GateStatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap">{r.plannedTime ? formatDateTime(r.plannedTime) : '—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/material-outward/${r.id}`)}>View</ErpButton>
                        {perms.canVerifyOutward && !['released', 'rejected', 'cancelled'].includes(r.status) ? (
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/gate/material-outward/verify?id=${r.id}`)}>Verify</ErpButton>
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
