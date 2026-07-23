import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { Button } from '@/components/ui/Button'
import { createOrgAccount, type OrgAccount } from '@/services/api/organisationApi'
import { isApiMode } from '@/config/apiConfig'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const GROUPS = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const

type AccountGroup = (typeof GROUPS)[number]

const EMPTY_FORM = {
  accountCode: '',
  accountName: '',
  accountGroup: 'ASSET' as AccountGroup,
  accountType: 'GENERAL',
}

export interface OrgAccountSelectProps {
  value: string
  onChange: (accountId: string) => void
  accounts: OrgAccount[]
  legalEntityId: string
  disabled?: boolean
  /** Show add-icon and allow quick create (requires CoA create permission). */
  canCreate?: boolean
  /** Called after a successful create so the parent can refresh options before selection sticks. */
  onAccountCreated?: (account: OrgAccount) => void | Promise<void>
  className?: string
  /** Optional default group when opening the create popup (e.g. from mapping key). */
  defaultAccountGroup?: AccountGroup
}

/**
 * Account dropdown with optional add-icon → quick-create popup.
 * Used on Organisation Account Mapping when the desired ledger is missing from the list.
 */
export function OrgAccountSelect({
  value,
  onChange,
  accounts,
  legalEntityId,
  disabled = false,
  canCreate = false,
  onAccountCreated,
  className,
  defaultAccountGroup = 'ASSET',
}: OrgAccountSelectProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, accountGroup: defaultAccountGroup })
    setOpen(true)
  }

  const save = async () => {
    if (!form.accountCode.trim() || !form.accountName.trim()) {
      notify.error('Account code and name are required')
      return
    }
    if (!isApiMode()) {
      notify.error('Create account requires API mode')
      return
    }
    if (!legalEntityId) {
      notify.error('Legal entity is required')
      return
    }
    setSaving(true)
    try {
      const created = await createOrgAccount({
        legalEntityId,
        accountCode: form.accountCode.trim(),
        accountName: form.accountName.trim(),
        accountGroup: form.accountGroup,
        accountType: form.accountType.trim() || 'GENERAL',
      })
      notify.success('Account created')
      setOpen(false)
      await onAccountCreated?.(created)
      onChange(created.id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="min-w-0 flex-1">
        <Select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{SELECT_PLACEHOLDER}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.accountCode} — {a.accountName}
            </option>
          ))}
        </Select>
      </div>
      {canCreate ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled || !legalEntityId}
          title="Add account"
          aria-label="Add account"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}

      <AccountDrawerShell
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="New Account"
        subtitle="Quick create — then select for this mapping"
        eyebrow="Organisation"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" size="sm" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </ErpButton>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Account Code" required>
            <Input
              value={form.accountCode}
              autoFocus
              onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))}
            />
          </FormField>
          <FormField label="Account Name" required>
            <Input
              value={form.accountName}
              onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
            />
          </FormField>
          <FormField label="Account Group">
            <Select
              value={form.accountGroup}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountGroup: e.target.value as AccountGroup }))
              }
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
            <Input
              value={form.accountType}
              onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
            />
          </FormField>
        </div>
      </AccountDrawerShell>
    </div>
  )
}
