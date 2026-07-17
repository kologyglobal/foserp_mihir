import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import {
  closePeriod,
  generatePeriods,
  listFinancialYears,
  listPeriods,
  reopenPeriod,
} from '@/services/bridges/financeApiBridge'
import type { AccountingPeriod, FinancialYear } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { FinanceSettingsTable } from './financeSettingsShared'

export function PeriodsPage() {
  const perms = useFinancePermissions()
  const [years, setYears] = useState<FinancialYear[]>([])
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [reopenTarget, setReopenTarget] = useState<AccountingPeriod | null>(null)
  const [reopenReason, setReopenReason] = useState('')

  const currentFy = useMemo(
    () => years.find((y) => y.isCurrent && y.status === 'ACTIVE') ?? years.find((y) => y.status === 'ACTIVE') ?? years[0],
    [years],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const fyRows = await listFinancialYears()
      setYears(fyRows)
      const active = fyRows.find((y) => y.isCurrent && y.status === 'ACTIVE') ?? fyRows.find((y) => y.status === 'ACTIVE') ?? fyRows[0]
      if (active) setPeriods(await listPeriods(undefined, active.id))
      else setPeriods([])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load periods')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const handleGenerate = async () => {
    if (!currentFy) {
      notify.error('Create and activate a financial year first.')
      return
    }
    try {
      await generatePeriods(currentFy.id)
      notify.success('Periods generated.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    }
  }

  const handleClose = async (id: string) => {
    if (!window.confirm('Close this period?')) return
    try {
      await closePeriod(id)
      notify.success('Period closed.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Close failed')
    }
  }

  const handleReopen = async () => {
    if (!reopenTarget || !reopenReason.trim()) return
    try {
      await reopenPeriod(reopenTarget.id, reopenReason.trim())
      notify.success('Period reopened.')
      setReopenTarget(null)
      setReopenReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reopen failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Accounting Periods"
      actions={
        perms.canManagePeriod && currentFy ? (
          <ErpButton size="sm" onClick={() => void handleGenerate()}>
            Generate Periods
          </ErpButton>
        ) : null
      }
    >
      {currentFy ? (
        <p className="mb-3 text-[12px] text-erp-muted">
          Financial year: <strong>{currentFy.name}</strong> ({currentFy.startDate} – {currentFy.endDate})
        </p>
      ) : (
        <p className="mb-3 text-[12px] text-amber-800">No active financial year — create one first.</p>
      )}
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        periods.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No periods yet. Click Generate Periods to create 12 monthly periods.</p>
        ) : (
          <FinanceSettingsTable headers={['#', 'Name', 'Start', 'End', 'Status', 'Actions']}>
            {periods.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">{p.periodNumber}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.startDate}</td>
                <td className="px-3 py-2">{p.endDate}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {p.status !== 'CLOSED' && perms.canClosePeriod ? (
                      <ErpButton size="sm" variant="outline" onClick={() => void handleClose(p.id)}>
                        Close
                      </ErpButton>
                    ) : null}
                    {p.status === 'CLOSED' && perms.canReopenPeriod ? (
                      <ErpButton size="sm" variant="outline" onClick={() => setReopenTarget(p)}>
                        Reopen
                      </ErpButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </FinanceSettingsTable>
        )
      ) : null}

      <Modal
        open={Boolean(reopenTarget)}
        onClose={() => setReopenTarget(null)}
        title="Reopen period"
        description={`Provide a reason to reopen ${reopenTarget?.name ?? 'period'}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReopenTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleReopen()} disabled={!reopenReason.trim()}>
              Reopen
            </Button>
          </div>
        }
      >
        <FormField label="Reason" required>
          <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="e.g. Correction for accrual entry" />
        </FormField>
      </Modal>
    </FinanceSettingsShell>
  )
}
