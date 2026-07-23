import { useCallback, useEffect, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FinanceSettingsTable } from '@/modules/accounting/settings/financeSettingsShared'
import { OrganisationSetupShell } from './OrganisationSetupShell'
import { OrgAccountSelect } from './OrgAccountSelect'
import {
  listOrgAccountMappings,
  listOrgChartOfAccounts,
  upsertOrgAccountMappings,
  type OrgAccount,
  type OrgMapping,
} from '@/services/api/organisationApi'
import { ensureLegalEntity, listAccounts, getDefaultMappings } from '@/services/bridges/financeApiBridge'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'

const KEYS = [
  'CUSTOMER_RECEIVABLE',
  'VENDOR_PAYABLE',
  'SALES_REVENUE',
  'PURCHASE',
  'GST_INPUT_CGST',
  'GST_INPUT_SGST',
  'GST_INPUT_IGST',
  'GST_OUTPUT_CGST',
  'GST_OUTPUT_SGST',
  'GST_OUTPUT_IGST',
  'RETAINED_EARNINGS',
  'RAW_MATERIAL_INVENTORY',
  'WIP_INVENTORY',
  'FINISHED_GOODS_INVENTORY',
] as const

type MappingKey = (typeof KEYS)[number]
type AccountGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

function defaultGroupForKey(key: MappingKey): AccountGroup {
  if (key === 'SALES_REVENUE') return 'INCOME'
  if (key === 'PURCHASE') return 'EXPENSE'
  if (key === 'RETAINED_EARNINGS') return 'EQUITY'
  if (key === 'VENDOR_PAYABLE' || key.startsWith('GST_OUTPUT')) return 'LIABILITY'
  return 'ASSET'
}

export function OrgAccountMappingPage() {
  const perms = useOrganisationPermissions()
  const [loading, setLoading] = useState(true)
  const [legalEntityId, setLegalEntityId] = useState('')
  const [accounts, setAccounts] = useState<OrgAccount[]>([])
  const [values, setValues] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const le = await ensureLegalEntity()
      setLegalEntityId(le.id)
      let accts: OrgAccount[] = []
      let mappings: OrgMapping[] = []
      if (isApiMode()) {
        accts = await listOrgChartOfAccounts(le.id)
        mappings = await listOrgAccountMappings(le.id)
      } else {
        const [a, m] = await Promise.all([listAccounts(), getDefaultMappings()])
        accts = a.map((x) => ({
          id: x.id,
          accountCode: x.accountCode,
          accountName: x.accountName,
          category: x.category,
          accountType: x.accountType,
          isGroup: x.isGroup,
          isActive: x.isActive,
        }))
        mappings = m.map((x) => ({
          id: x.id,
          legalEntityId: x.legalEntityId,
          transactionType: x.mappingKey,
          accountId: x.accountId,
        }))
      }
      setAccounts(accts.filter((a) => !a.isGroup && a.isActive))
      const next: Record<string, string> = {}
      for (const key of KEYS) next[key] = ''
      for (const m of mappings) {
        if (m.transactionType in next) next[m.transactionType] = m.accountId
      }
      setValues(next)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canManageMapping || perms.canViewCoa) void load()
  }, [load, perms.canManageMapping, perms.canViewCoa])

  const save = async () => {
    try {
      if (!isApiMode()) {
        notify.error('Save mappings requires API mode')
        return
      }
      const mappings = Object.entries(values)
        .filter(([, accountId]) => Boolean(accountId))
        .map(([transactionType, accountId]) => ({ transactionType, accountId }))
      if (mappings.length === 0) {
        notify.error('Select at least one account mapping')
        return
      }
      await upsertOrgAccountMappings(legalEntityId, mappings)
      notify.success('Account mappings saved')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleAccountCreated = async (created: OrgAccount) => {
    if (!created.isGroup && created.isActive) {
      setAccounts((prev) => {
        if (prev.some((a) => a.id === created.id)) return prev
        return [...prev, created].sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      })
      return
    }
    await load()
  }

  return (
    <OrganisationSetupShell
      title="Account Mapping"
      description="Map posting transaction types to chart of accounts leaves. Use + when the account is missing from the list."
      actions={
        perms.canManageMapping ? (
          <ErpButton size="sm" onClick={() => void save()}>
            Save Mappings
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading ? (
        <FinanceSettingsTable headers={['Transaction Type', 'Account']}>
          {KEYS.map((key) => (
            <tr key={key}>
              <td className="px-3 py-2 font-medium">{key.replaceAll('_', ' ')}</td>
              <td className="px-3 py-2">
                <OrgAccountSelect
                  value={values[key] ?? ''}
                  accounts={accounts}
                  legalEntityId={legalEntityId}
                  disabled={!perms.canManageMapping}
                  canCreate={perms.canCreateCoa && perms.canManageMapping}
                  defaultAccountGroup={defaultGroupForKey(key)}
                  onChange={(accountId) => setValues((v) => ({ ...v, [key]: accountId }))}
                  onAccountCreated={handleAccountCreated}
                />
              </td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}
    </OrganisationSetupShell>
  )
}
