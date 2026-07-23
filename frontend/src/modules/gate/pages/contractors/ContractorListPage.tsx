import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Download, HardHat, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { ContractorEntry } from '../../types/gate.types'
import {
  isContractorPassExpired,
  isContractorPassExpiringToday,
  todayIsoDate,
} from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateDataStates, GateModal, GateStatusBadge, InsideDuration, OverdueIndicator } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

export function ContractorListPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
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

  const [rows, setRows] = useState<ContractorEntry[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [exitContractor, setExitContractor] = useState<ContractorEntry | null>(null)
  const [exitRemarks, setExitRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const data = await gateService.getContractors({ search: search || undefined })
      setRows(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contractors')
      setState('error')
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const alerts = useMemo(() => {
    const inside = rows.filter((r) => r.status === 'inside')
    return {
      expired: inside.filter((r) => isContractorPassExpired(r.validUntil)).length,
      expiringToday: inside.filter((r) => isContractorPassExpiringToday(r.validUntil)).length,
      missingInduction: inside.filter((r) => !r.safetyInductionDone).length,
      inside: inside.length,
    }
  }, [rows])

  const exportCsv = () => {
    exportGateCsv(
      `contractors-${todayIsoDate()}.csv`,
      ['Entry No.', 'Worker', 'Mobile', 'Company', 'Department', 'Supervisor', 'Valid Until', 'Entry Time', 'Exit Time', 'Status'],
      rows.map((r) => [
        r.entryNumber,
        r.workerName,
        r.mobile,
        r.contractorCompany,
        r.department,
        r.supervisor,
        r.validUntil,
        r.entryTime ? formatDateTime(r.entryTime) : '',
        r.exitTime ? formatDateTime(r.exitTime) : '',
        r.status,
      ]),
    )
    notify.success('Contractor register exported.')
  }

  const confirmExit = async () => {
    if (!exitContractor || busy) return
    setBusy(true)
    try {
      await gateService.recordContractorExit(exitContractor.id, exitRemarks.trim() || undefined)
      notify.success(`Exit recorded for ${exitContractor.workerName}.`)
      setExitContractor(null)
      setExitRemarks('')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record exit')
    } finally {
      setBusy(false)
    }
  }

  const promptExit = async (row: ContractorEntry) => {
    if (perms.canContractorExit) {
      setExitContractor(row)
      setExitRemarks('')
      return
    }
    const remarks = await appPromptNote({
      title: 'Record contractor exit',
      description: `${row.entryNumber} · ${row.workerName}`,
      confirmLabel: 'Confirm Exit',
      note: { label: 'Exit remarks', rows: 2 },
    })
    if (remarks == null) return
    try {
      await gateService.recordContractorExit(row.id, remarks.trim() || undefined)
      notify.success(`Exit recorded for ${row.workerName}.`)
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record exit')
    }
  }

  if (!perms.canViewContractor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Contractors" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view contractor records." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Contractor Register"
      description="Contract worker entry with validity, safety induction and exit tracking — no payroll or attendance."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Contractors' }]}
      favoritePath="/gate/contractors"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateContractor
              ? { id: 'new', label: 'New Contractor Entry', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/contractors/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: exportCsv, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      {(alerts.expired > 0 || alerts.expiringToday > 0 || alerts.missingInduction > 0 || alerts.inside > 0) ? (
        <div className="flex flex-wrap gap-2 border-b border-erp-border bg-erp-surface-alt/50 px-3 py-2">
          {alerts.inside > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800">
              <HardHat className="h-3.5 w-3.5" aria-hidden />
              {alerts.inside} currently inside
            </span>
          ) : null}
          {alerts.expired > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[12px] font-medium text-rose-800">
              <OverdueIndicator label="Expired pass" />
              {alerts.expired}
            </span>
          ) : null}
          {alerts.expiringToday > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {alerts.expiringToday} pass expiring today
            </span>
          ) : null}
          {alerts.missingInduction > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {alerts.missingInduction} missing safety induction
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput
          value={search}
          onChange={(v) => setParam('q', v)}
          placeholder="Search entry no., worker, mobile, company, supervisor…"
          className="w-72"
          aria-label="Search contractors"
        />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={HardHat}
          emptyTitle="No contractor entries"
          emptyDescription="Register contract workers when they arrive at the gate."
          emptyAction={
            perms.canCreateContractor ? (
              <ErpButton size="sm" onClick={() => navigate('/gate/contractors/new')}>
                New Contractor Entry
              </ErpButton>
            ) : undefined
          }
        >
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Entry No.</th>
                  <th>Worker</th>
                  <th>Mobile</th>
                  <th>Company</th>
                  <th>Department</th>
                  <th>Supervisor</th>
                  <th>Work Location</th>
                  <th>Valid Until</th>
                  <th>Entry Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = r.status === 'inside' && isContractorPassExpired(r.validUntil)
                  const expiringToday = r.status === 'inside' && isContractorPassExpiringToday(r.validUntil)
                  return (
                    <tr key={r.id} className={expired ? 'bg-rose-50/60' : undefined}>
                      <td className="tabular-nums">
                        <TableLink to={`/gate/contractors/${r.id}`}>{r.entryNumber}</TableLink>
                      </td>
                      <td className="font-medium">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {r.workerName}
                          {expired ? <OverdueIndicator label="Expired" /> : null}
                          {!expired && expiringToday ? <OverdueIndicator label="Expires today" /> : null}
                          {r.status === 'inside' && !r.safetyInductionDone ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">No induction</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="tabular-nums">{r.mobile}</td>
                      <td className="max-w-[140px] truncate">{r.contractorCompany}</td>
                      <td>{r.department}</td>
                      <td>{r.supervisor}</td>
                      <td className="max-w-[150px] truncate">{r.workLocation}</td>
                      <td className="whitespace-nowrap">{formatDate(r.validUntil)}</td>
                      <td className="whitespace-nowrap">{r.entryTime ? formatDateTime(r.entryTime) : '—'}</td>
                      <td>
                        <InsideDuration from={r.entryTime} to={r.exitTime} />
                      </td>
                      <td>
                        <GateStatusBadge status={r.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/contractors/${r.id}`)}>
                            View
                          </ErpButton>
                          {r.status === 'inside' && perms.canContractorExit ? (
                            <ErpButton size="sm" variant="outline" onClick={() => void promptExit(r)}>
                              Exit
                            </ErpButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>

      <GateModal
        open={Boolean(exitContractor)}
        onClose={() => setExitContractor(null)}
        title="Record Contractor Exit"
        subtitle={exitContractor ? `${exitContractor.entryNumber} · ${exitContractor.workerName}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => setExitContractor(null)} disabled={busy}>
              Cancel
            </ErpButton>
            <ErpButton onClick={() => void confirmExit()} loading={busy} disabled={busy}>
              Confirm Exit
            </ErpButton>
          </div>
        }
      >
        {exitContractor ? (
          <div className="space-y-3 text-[13px]">
            <p>
              <span className="text-erp-muted">Company:</span>{' '}
              <span className="font-medium">{exitContractor.contractorCompany}</span>
            </p>
            <p>
              <span className="text-erp-muted">Inside since:</span>{' '}
              <InsideDuration from={exitContractor.entryTime} />
            </p>
            <label className="block text-[12px] font-medium text-erp-muted">
              Exit remarks
              <textarea
                className="mt-1 w-full rounded-md border border-erp-border px-2 py-1.5 text-[13px]"
                rows={2}
                value={exitRemarks}
                onChange={(e) => setExitRemarks(e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </GateModal>
    </OperationalPageShell>
  )
}
