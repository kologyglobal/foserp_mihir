import { useCallback, useEffect, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FinanceSettingsTable } from '@/modules/accounting/settings/financeSettingsShared'
import { OrganisationSetupShell } from './OrganisationSetupShell'
import {
  generateOrgPostingPeriods,
  listOrgFiscalYears,
  listOrgPostingPeriods,
  type OrgFiscalYear,
  type OrgPeriod,
} from '@/services/api/organisationApi'
import { ensureLegalEntity, generatePeriods, listFinancialYears, listPeriods } from '@/services/bridges/financeApiBridge'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'

export function OrgPostingPeriodsPage() {
  const perms = useOrganisationPermissions()
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState<OrgFiscalYear[]>([])
  const [financialYearId, setFinancialYearId] = useState('')
  const [rows, setRows] = useState<OrgPeriod[]>([])
  const [legalEntityId, setLegalEntityId] = useState('')

  const loadYears = useCallback(async () => {
    const le = await ensureLegalEntity()
    setLegalEntityId(le.id)
    const list = isApiMode() ? await listOrgFiscalYears(le.id) : await listFinancialYears()
    const mapped = list.map((y) => ({
      id: y.id,
      name: 'name' in y ? y.name : (y as OrgFiscalYear).name,
      startDate: y.startDate,
      endDate: y.endDate,
      status: y.status,
      isCurrent: y.isCurrent,
    }))
    setYears(mapped)
    const current = mapped.find((y) => y.isCurrent) ?? mapped[0]
    if (current) setFinancialYearId(current.id)
    return { leId: le.id, fyId: current?.id ?? '' }
  }, [])

  const loadPeriods = useCallback(async (leId: string, fyId: string) => {
    if (!leId || !fyId) {
      setRows([])
      return
    }
    if (isApiMode()) {
      setRows(await listOrgPostingPeriods({ legalEntityId: leId, financialYearId: fyId }))
    } else {
      const periods = await listPeriods()
      setRows(
        periods
          .filter((p) => p.financialYearId === fyId)
          .map((p) => ({
            id: p.id,
            name: p.name,
            periodNumber: p.periodNumber,
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status,
            financialYearId: p.financialYearId,
          })),
      )
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const { leId, fyId } = await loadYears()
      await loadPeriods(leId, fyId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load periods')
    } finally {
      setLoading(false)
    }
  }, [loadPeriods, loadYears])

  useEffect(() => {
    if (perms.canManagePeriods || perms.canView) void reload()
  }, [perms.canManagePeriods, perms.canView, reload])

  useEffect(() => {
    if (legalEntityId && financialYearId) void loadPeriods(legalEntityId, financialYearId)
  }, [financialYearId, legalEntityId, loadPeriods])

  const generate = async () => {
    try {
      if (!financialYearId) {
        notify.error('Select a fiscal year')
        return
      }
      if (isApiMode()) {
        await generateOrgPostingPeriods(financialYearId)
      } else {
        await generatePeriods(financialYearId)
      }
      notify.success('Posting periods generated')
      await loadPeriods(legalEntityId, financialYearId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    }
  }

  return (
    <OrganisationSetupShell
      title="Posting Periods"
      description="Monthly periods for the selected fiscal year. Closed periods cannot be edited."
      actions={
        perms.canManagePeriods ? (
          <ErpButton size="sm" onClick={() => void generate()}>
            Generate Periods
          </ErpButton>
        ) : null
      }
    >
      <div className="mb-3 max-w-sm">
        <FormField label="Fiscal Year">
          <Select value={financialYearId} onChange={(e) => setFinancialYearId(e.target.value)}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {loading ? <LoadingState variant="form" /> : null}
      {!loading ? (
        <FinanceSettingsTable headers={['#', 'Name', 'Start', 'End', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2">{row.periodNumber}</td>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{String(row.startDate).slice(0, 10)}</td>
              <td className="px-3 py-2">{String(row.endDate).slice(0, 10)}</td>
              <td className="px-3 py-2">{row.status}</td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}
    </OrganisationSetupShell>
  )
}
