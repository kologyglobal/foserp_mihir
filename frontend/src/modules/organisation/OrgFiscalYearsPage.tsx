import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { FinanceSettingsTable } from '@/modules/accounting/settings/financeSettingsShared'
import { OrganisationSetupShell } from './OrganisationSetupShell'
import { createOrgFiscalYear, listOrgFiscalYears, type OrgFiscalYear } from '@/services/api/organisationApi'
import { ensureLegalEntity, listFinancialYears } from '@/services/bridges/financeApiBridge'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'

export function OrgFiscalYearsPage() {
  const perms = useOrganisationPermissions()
  const [rows, setRows] = useState<OrgFiscalYear[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [legalEntityId, setLegalEntityId] = useState('')
  const [form, setForm] = useState({
    financialYear: 'FY 2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    status: 'ACTIVE' as 'DRAFT' | 'ACTIVE' | 'CLOSED',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const le = await ensureLegalEntity()
      setLegalEntityId(le.id)
      if (isApiMode()) {
        setRows(await listOrgFiscalYears(le.id))
      } else {
        const years = await listFinancialYears()
        setRows(
          years.map((y) => ({
            id: y.id,
            name: y.name,
            startDate: y.startDate,
            endDate: y.endDate,
            status: y.status,
            isCurrent: y.isCurrent,
          })),
        )
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load fiscal years')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canManageFy || perms.canView) void load()
  }, [load, perms.canManageFy, perms.canView])

  const save = async () => {
    try {
      if (!isApiMode()) {
        notify.error('Create fiscal year requires API mode')
        return
      }
      await createOrgFiscalYear({ ...form, legalEntityId })
      notify.success('Fiscal year created')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <OrganisationSetupShell
      title="Fiscal Years"
      actions={
        perms.canManageFy ? (
          <ErpButton size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Year
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading ? (
        <FinanceSettingsTable headers={['Name', 'Start', 'End', 'Status', 'Current']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{String(row.startDate).slice(0, 10)}</td>
              <td className="px-3 py-2">{String(row.endDate).slice(0, 10)}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.isCurrent ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Fiscal Year"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton onClick={() => void save()}>Save</ErpButton>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Name">
            <Input value={form.financialYear} onChange={(e) => setForm((f) => ({ ...f, financialYear: e.target.value }))} />
          </FormField>
          <FormField label="Start Date">
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </FormField>
          <FormField label="End Date">
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </FormField>
        </div>
      </AccountDrawerShell>
    </OrganisationSetupShell>
  )
}
