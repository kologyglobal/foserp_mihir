import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import {
  activateFinancialYear,
  closeFinancialYear,
  createFinancialYear,
  listFinancialYears,
  resolveLegalEntityId,
} from '@/services/bridges/financeApiBridge'
import type { FinancialYear } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { FinanceSettingsTable } from './financeSettingsShared'

export function FinancialYearsPage() {
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<FinancialYear[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ name: 'FY 2025-26', startDate: '2025-04-01', endDate: '2026-03-31' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listFinancialYears())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load financial years')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    try {
      await createFinancialYear({ ...form, legalEntityId: resolveLegalEntityId() })
      notify.success('Financial year created.')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (!window.confirm(`${label}?`)) return
    try {
      await fn()
      notify.success(`${label} completed.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Financial Years"
      actions={
        perms.canManageFinancialYear ? (
          <ErpButton size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Year
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        <FinanceSettingsTable headers={['Name', 'Start', 'End', 'Status', 'Current', 'Actions']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{row.startDate}</td>
              <td className="px-3 py-2">{row.endDate}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.isCurrent ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">
                {perms.canManageFinancialYear ? (
                  <div className="flex flex-wrap gap-1">
                    {row.status !== 'ACTIVE' ? (
                      <ErpButton size="sm" variant="outline" onClick={() => void runAction('Activate financial year', () => activateFinancialYear(row.id))}>
                        Activate
                      </ErpButton>
                    ) : (
                      <ErpButton size="sm" variant="outline" onClick={() => void runAction('Close financial year', () => closeFinancialYear(row.id))}>
                        Close
                      </ErpButton>
                    )}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Financial Year"
        eyebrow="Finance Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</ErpButton>
            <ErpButton onClick={() => void save()} disabled={!perms.canManageFinancialYear}>Create</ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></FormField>
          <FormField label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></FormField>
          <FormField label="End date"><Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></FormField>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
