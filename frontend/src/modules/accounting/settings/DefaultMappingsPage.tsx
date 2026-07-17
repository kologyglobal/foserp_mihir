import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  DEFAULT_MAPPING_LABELS,
  MANDATORY_MAPPING_KEYS,
  type DefaultAccountMappingKey,
} from '@/types/financeSetup'
import {
  getDefaultMappings,
  listAccounts,
  saveDefaultMappings,
  validateDefaultMappings,
} from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

const OPTIONAL_KEYS = Object.keys(DEFAULT_MAPPING_LABELS).filter(
  (k) => !MANDATORY_MAPPING_KEYS.includes(k as DefaultAccountMappingKey),
) as DefaultAccountMappingKey[]

export function DefaultMappingsPage() {
  const perms = useFinancePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [validation, setValidation] = useState<string | null>(null)

  const postingAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && !a.isGroup),
    [accounts],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [accts, mappings] = await Promise.all([listAccounts(), getDefaultMappings()])
      setAccounts(accts)
      const map: Record<string, string> = {}
      for (const m of mappings) map[m.mappingKey] = m.accountId
      setValues(map)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const handleSave = async () => {
    try {
      const rows = Object.entries(values)
        .filter(([, accountId]) => accountId)
        .map(([mappingKey, accountId]) => ({ mappingKey, accountId }))
      await saveDefaultMappings(rows)
      notify.success('Mappings saved.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleValidate = async () => {
    try {
      const res = await validateDefaultMappings()
      if (res.valid) {
        setValidation('All mandatory mappings are configured.')
        notify.success('Validation passed.')
      } else {
        setValidation(res.errors.map((e) => e.message).join('; '))
        notify.error('Validation failed.')
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const renderRow = (key: DefaultAccountMappingKey, mandatory: boolean) => (
    <div key={key} className="grid grid-cols-1 gap-2 border-b border-erp-border py-2 md:grid-cols-[1fr_280px] md:items-center">
      <div>
        <div className="text-[13px] font-medium text-erp-text">{DEFAULT_MAPPING_LABELS[key]}</div>
        <div className="text-[11px] text-erp-muted">{mandatory ? 'Required for activation' : 'Optional'}</div>
      </div>
      <Select
        value={values[key] ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        disabled={!perms.canManageMappings}
      >
        <option value="">— Select ledger —</option>
        {postingAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.accountCode} · {a.accountName}
          </option>
        ))}
      </Select>
    </div>
  )

  return (
    <FinanceSettingsShell
      title="Default Account Mapping"
      description="Map system posting keys to ledger accounts. Only posting (non-group) accounts are shown."
      actions={
        <>
          {perms.canManageMappings ? (
            <ErpButton size="sm" variant="outline" onClick={() => void handleValidate()}>
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Validate
            </ErpButton>
          ) : null}
          {perms.canManageMappings ? (
            <ErpButton size="sm" onClick={() => void handleSave()}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Save
            </ErpButton>
          ) : null}
        </>
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && validation ? <p className="mb-3 text-[12px] text-erp-muted">{validation}</p> : null}
      {!loading && perms.canView ? (
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Mandatory mappings</h2>
            {MANDATORY_MAPPING_KEYS.map((k) => renderRow(k, true))}
          </section>
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Optional mappings</h2>
            {OPTIONAL_KEYS.map((k) => renderRow(k, false))}
          </section>
        </div>
      ) : null}
    </FinanceSettingsShell>
  )
}
