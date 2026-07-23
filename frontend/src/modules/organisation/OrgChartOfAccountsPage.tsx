import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { FinanceSettingsTable } from '@/modules/accounting/settings/financeSettingsShared'
import { OrganisationSetupShell } from './OrganisationSetupShell'
import { createOrgAccount, listOrgChartOfAccounts, type OrgAccount } from '@/services/api/organisationApi'
import { ensureLegalEntity, listAccounts } from '@/services/bridges/financeApiBridge'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'

const GROUPS = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const

export function OrgChartOfAccountsPage() {
  const perms = useOrganisationPermissions()
  const [rows, setRows] = useState<OrgAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [legalEntityId, setLegalEntityId] = useState('')
  const [form, setForm] = useState({
    accountCode: '',
    accountName: '',
    accountGroup: 'ASSET' as (typeof GROUPS)[number],
    accountType: 'GENERAL',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const le = await ensureLegalEntity()
      setLegalEntityId(le.id)
      if (isApiMode()) {
        setRows(await listOrgChartOfAccounts(le.id))
      } else {
        const accounts = await listAccounts()
        setRows(
          accounts.map((a) => ({
            id: a.id,
            accountCode: a.accountCode,
            accountName: a.accountName,
            category: a.category,
            accountType: a.accountType,
            isGroup: a.isGroup,
            isActive: a.isActive,
          })),
        )
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load chart of accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewCoa) void load()
  }, [load, perms.canViewCoa])

  const save = async () => {
    try {
      if (!isApiMode()) {
        notify.error('Create account requires API mode')
        return
      }
      await createOrgAccount({ ...form, legalEntityId })
      notify.success('Account created')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <OrganisationSetupShell
      title="Chart of Accounts"
      description="Leaf and group accounts for the active legal entity."
      actions={
        perms.canCreateCoa ? (
          <ErpButton
            size="sm"
            onClick={() => {
              setForm({ accountCode: '', accountName: '', accountGroup: 'ASSET', accountType: 'GENERAL' })
              setDrawerOpen(true)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Account
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canViewCoa ? (
        <FinanceSettingsTable headers={['Code', 'Name', 'Group', 'Type', 'Active']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.accountCode}</td>
              <td className="px-3 py-2">{row.accountName}</td>
              <td className="px-3 py-2">{row.category}</td>
              <td className="px-3 py-2">{row.accountType}</td>
              <td className="px-3 py-2">{row.isActive ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Account"
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
          <FormField label="Account Code">
            <Input value={form.accountCode} onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))} />
          </FormField>
          <FormField label="Account Name">
            <Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
          </FormField>
          <FormField label="Account Group">
            <Select
              value={form.accountGroup}
              onChange={(e) => setForm((f) => ({ ...f, accountGroup: e.target.value as (typeof GROUPS)[number] }))}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Account Type">
            <Input value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))} />
          </FormField>
        </div>
      </AccountDrawerShell>
    </OrganisationSetupShell>
  )
}
