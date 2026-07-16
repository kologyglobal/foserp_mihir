import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AccountDrawerShell } from './AccountDrawerShell'
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_TYPES,
  CONTROL_ACCOUNT_TYPES,
  COST_ELEMENT_TYPES,
  GST_ACCOUNT_TYPES,
  MANUFACTURING_ACCOUNT_TYPES,
  NORMAL_BALANCES,
  TDS_ACCOUNT_TYPES,
  defaultDimensionConfiguration,
  defaultManufacturingConfiguration,
  defaultPostingControl,
  defaultTaxConfiguration,
  type AccountFormInput,
  type AccountType,
  type ChartOfAccount,
  type DimensionLookupOption,
} from '@/types/chartOfAccounts'
import {
  createAccount,
  updateAccount,
  validateAccountInput,
  ChartOfAccountsServiceError,
} from '@/services/accounting/chartOfAccountsService'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

type DimensionLookups = {
  costCentres: DimensionLookupOption[]
  departments: DimensionLookupOption[]
  projects: DimensionLookupOption[]
  plants: DimensionLookupOption[]
  locations: DimensionLookupOption[]
}

type FormTab = 'general' | 'posting' | 'tax' | 'manufacturing' | 'dimensions' | 'audit'

const TABS: { id: FormTab; label: string; postingOnly?: boolean; editOnly?: boolean }[] = [
  { id: 'general', label: 'General' },
  { id: 'posting', label: 'Posting controls', postingOnly: true },
  { id: 'tax', label: 'Tax & compliance' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'audit', label: 'Audit', editOnly: true },
]

function accountToFormInput(account: ChartOfAccount): AccountFormInput {
  return {
    code: account.code,
    name: account.name,
    alias: account.alias,
    accountType: account.accountType,
    category: account.category,
    parentId: account.parentId,
    normalBalance: account.normalBalance,
    description: account.description,
    active: account.active,
    systemAccount: account.systemAccount,
    posting: { ...account.posting },
    tax: { ...account.tax },
    manufacturing: { ...account.manufacturing },
    dimensions: { ...account.dimensions },
  }
}

function emptyForm(accountType: AccountType): AccountFormInput {
  return {
    code: '',
    name: '',
    alias: '',
    accountType,
    category: 'Asset',
    parentId: null,
    normalBalance: 'Debit',
    description: '',
    active: true,
    systemAccount: false,
    posting: defaultPostingControl(accountType),
    tax: defaultTaxConfiguration(),
    manufacturing: defaultManufacturingConfiguration(),
    dimensions: defaultDimensionConfiguration(),
  }
}

function mapValidationErrors(errors: string[]): Record<string, string> {
  const formErrors: Record<string, string> = {}
  const unmapped: string[] = []
  for (const err of errors) {
    const lower = err.toLowerCase()
    if (lower.includes('account code')) formErrors.code = err
    else if (lower.includes('account name')) formErrors.name = err
    else if (lower.includes('parent')) formErrors.parentId = err
    else if (lower.includes('account type')) formErrors.accountType = err
    else if (lower.includes('category')) formErrors.category = err
    else if (lower.includes('direct posting')) formErrors.allowDirectPosting = err
    else if (lower.includes('control account')) formErrors.isControlAccount = err
    else unmapped.push(err)
  }
  if (unmapped.length) formErrors._summary = unmapped.join('; ')
  return formErrors
}

const FIELD_TAB: Record<string, FormTab> = {
  code: 'general',
  name: 'general',
  alias: 'general',
  accountType: 'general',
  category: 'general',
  parentId: 'general',
  normalBalance: 'general',
  description: 'general',
  active: 'general',
  allowDirectPosting: 'posting',
  isControlAccount: 'posting',
}

function FormLabel({
  htmlFor,
  label,
  required,
  error,
}: {
  htmlFor?: string
  label: string
  required?: boolean
  error?: string
}) {
  return (
    <div className="space-y-0.5">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold text-erp-text">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  )
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className={cn('flex items-center gap-2 text-[12px]', disabled && 'opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-erp-border"
      />
      <span>{label}</span>
    </label>
  )
}

export function AccountFormDrawer({
  open,
  onClose,
  mode,
  initialAccountType = 'Posting',
  account,
  accounts,
  dimensionLookups,
  canManageSystem,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialAccountType?: AccountType
  account?: ChartOfAccount | null
  accounts: ChartOfAccount[]
  dimensionLookups: DimensionLookups
  canManageSystem: boolean
  onSaved: (account: ChartOfAccount) => void
}) {
  const [form, setForm] = useState<AccountFormInput>(() => emptyForm(initialAccountType))
  const [tab, setTab] = useState<FormTab>('general')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const groupParents = useMemo(
    () =>
      accounts
        .filter((a) => a.accountType === 'Group' && a.id !== account?.id)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts, account?.id],
  )

  const isGroup = form.accountType === 'Group'
  const isSystem = mode === 'edit' && account?.systemAccount
  const codeReadOnly = Boolean(isSystem && !canManageSystem)
  const controlDirectWarning = form.posting.isControlAccount && form.posting.allowDirectPosting && !isGroup

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && account) {
      setForm(accountToFormInput(account))
    } else {
      const base = emptyForm(initialAccountType)
      if (account?.parentId) {
        base.parentId = account.parentId
        base.category = account.category
        base.normalBalance = account.normalBalance
      }
      setForm(base)
    }
    setTab('general')
    setFormErrors({})
    setSaveError(null)
    setBusy(false)
  }, [open, mode, account, initialAccountType])

  function patchForm(patch: Partial<AccountFormInput>) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (patch.accountType) {
        next.posting = defaultPostingControl(patch.accountType)
        if (patch.accountType === 'Group') {
          next.posting.allowDirectPosting = false
          next.posting.isControlAccount = false
          next.posting.controlAccountType = null
        }
      }
      return next
    })
  }

  function patchPosting(patch: Partial<AccountFormInput['posting']>) {
    setForm((prev) => {
      const posting = { ...prev.posting, ...patch }
      if (prev.accountType === 'Group') {
        posting.allowDirectPosting = false
        posting.isControlAccount = false
        posting.controlAccountType = null
      }
      return { ...prev, posting }
    })
  }

  function focusFirstInvalid(errors: Record<string, string>) {
    const firstKey = Object.keys(errors).find((k) => k !== '_summary')
    if (!firstKey) return
    const targetTab = FIELD_TAB[firstKey] ?? 'general'
    setTab(targetTab)
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)
      el?.focus()
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    const normalized: AccountFormInput = isGroup
      ? {
          ...form,
          posting: {
            ...form.posting,
            allowDirectPosting: false,
            allowManualJournalPosting: false,
            isControlAccount: false,
            controlAccountType: null,
          },
        }
      : form

    const errors = validateAccountInput(normalized, {
      id: mode === 'edit' ? account?.id : undefined,
      accounts,
    })
    if (errors.length) {
      const mapped = mapValidationErrors(errors)
      setFormErrors(mapped)
      focusFirstInvalid(mapped)
      return
    }

    setFormErrors({})
    setBusy(true)
    try {
      const saved =
        mode === 'edit' && account
          ? await updateAccount(account.id, normalized)
          : await createAccount(normalized)
      onSaved(saved)
      onClose()
    } catch (err) {
      const message = err instanceof ChartOfAccountsServiceError ? err.message : 'Save failed'
      setSaveError(message)
      const mapped = mapValidationErrors(message.split('; '))
      setFormErrors(mapped)
      focusFirstInvalid(mapped)
    } finally {
      setBusy(false)
    }
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.postingOnly && isGroup) return false
    if (t.editOnly && mode !== 'edit') return false
    return true
  })

  const title = mode === 'create' ? 'Create account' : 'Edit account'
  const codePreview = form.code.trim() || form.name.trim() ? `${form.code.trim() || '—'} – ${form.name.trim() || '—'}` : '—'

  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      eyebrow="Chart of accounts"
      title={title}
      subtitle={codePreview}
      widthClassName="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-4 text-[13px] font-semibold" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="coa-account-form"
            className="erp-btn erp-btn-primary h-9 px-4 text-[13px] font-semibold"
            disabled={busy}
          >
            {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      }
    >
      <form id="coa-account-form" ref={formRef} onSubmit={handleSave} className="space-y-4">
        {formErrors._summary ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800" role="alert">
            {formErrors._summary}
          </div>
        ) : null}
        {saveError && !formErrors._summary ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{saveError}</div>
        ) : null}
        {controlDirectWarning ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Control accounts typically block direct posting. Review before saving.</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1 border-b border-erp-border pb-2">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-semibold',
                tab === t.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'general' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormLabel htmlFor="coa-code" label="Account code" required error={formErrors.code} />
              <input
                id="coa-code"
                data-field="code"
                value={form.code}
                readOnly={codeReadOnly}
                onChange={(e) => patchForm({ code: e.target.value })}
                className={cn('erp-input h-9 w-full font-mono text-[12px]', codeReadOnly && 'bg-erp-surface-alt')}
                placeholder="e.g. 1150"
              />
              {isSystem ? <p className="mt-1 text-[11px] text-erp-muted">System account code is read-only.</p> : null}
            </div>
            <div className="sm:col-span-2">
              <FormLabel htmlFor="coa-name" label="Account name" required error={formErrors.name} />
              <input
                id="coa-name"
                data-field="name"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </div>
            <div className="sm:col-span-2">
              <FormLabel htmlFor="coa-alias" label="Alias" />
              <input
                id="coa-alias"
                value={form.alias}
                onChange={(e) => patchForm({ alias: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </div>
            <div>
              <FormLabel htmlFor="coa-type" label="Account type" required error={formErrors.accountType} />
              <select
                id="coa-type"
                data-field="accountType"
                value={form.accountType}
                disabled={isSystem}
                onChange={(e) => patchForm({ accountType: e.target.value as AccountType })}
                className="erp-input h-9 w-full text-[12px]"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel htmlFor="coa-category" label="Category" required error={formErrors.category} />
              <select
                id="coa-category"
                data-field="category"
                value={form.category}
                onChange={(e) => patchForm({ category: e.target.value as AccountFormInput['category'] })}
                className="erp-input h-9 w-full text-[12px]"
              >
                {ACCOUNT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FormLabel htmlFor="coa-parent" label="Parent account" error={formErrors.parentId} />
              <select
                id="coa-parent"
                data-field="parentId"
                value={form.parentId ?? ''}
                onChange={(e) => patchForm({ parentId: e.target.value || null })}
                className="erp-input h-9 w-full text-[12px]"
              >
                <option value="">— None (root group only if approved) —</option>
                {groupParents.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel htmlFor="coa-normal" label="Normal balance" />
              <select
                id="coa-normal"
                value={form.normalBalance}
                onChange={(e) => patchForm({ normalBalance: e.target.value as AccountFormInput['normalBalance'] })}
                className="erp-input h-9 w-full text-[12px]"
              >
                {NORMAL_BALANCES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <CheckboxField id="coa-active" label="Active" checked={form.active} onChange={(v) => patchForm({ active: v })} />
            </div>
            <div className="sm:col-span-2">
              <FormLabel htmlFor="coa-desc" label="Description" />
              <textarea
                id="coa-desc"
                value={form.description}
                onChange={(e) => patchForm({ description: e.target.value })}
                rows={2}
                className="erp-input w-full resize-y text-[12px]"
              />
            </div>
            <div className="sm:col-span-2 rounded-md bg-erp-surface px-3 py-2 text-[12px] text-erp-muted">
              Preview: <span className="font-semibold text-erp-text">{codePreview}</span>
            </div>
          </div>
        ) : null}

        {tab === 'posting' && !isGroup ? (
          <div className="space-y-3">
            <CheckboxField
              id="coa-direct"
              label="Allow direct posting"
              checked={form.posting.allowDirectPosting}
              onChange={(v) => patchPosting({ allowDirectPosting: v })}
            />
            {formErrors.allowDirectPosting ? (
              <p className="text-[11px] text-red-600">{formErrors.allowDirectPosting}</p>
            ) : null}
            <CheckboxField
              id="coa-manual"
              label="Allow manual journal posting"
              checked={form.posting.allowManualJournalPosting}
              onChange={(v) => patchPosting({ allowManualJournalPosting: v })}
            />
            <CheckboxField
              id="coa-control"
              label="Control account"
              checked={form.posting.isControlAccount}
              onChange={(v) =>
                patchPosting({
                  isControlAccount: v,
                  controlAccountType: v ? form.posting.controlAccountType ?? 'Other' : null,
                })
              }
            />
            {formErrors.isControlAccount ? (
              <p className="text-[11px] text-red-600">{formErrors.isControlAccount}</p>
            ) : null}
            {form.posting.isControlAccount ? (
              <div>
                <FormLabel htmlFor="coa-control-type" label="Control account type" />
                <select
                  id="coa-control-type"
                  value={form.posting.controlAccountType ?? ''}
                  onChange={(e) =>
                    patchPosting({
                      controlAccountType: e.target.value as AccountFormInput['posting']['controlAccountType'],
                    })
                  }
                  className="erp-input h-9 w-full text-[12px]"
                >
                  {CONTROL_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <CheckboxField
              id="coa-recon"
              label="Reconciliation required"
              checked={form.posting.reconciliationRequired}
              onChange={(v) => patchPosting({ reconciliationRequired: v })}
            />
            <CheckboxField
              id="coa-opening"
              label="Allow opening balance"
              checked={form.posting.allowOpeningBalance}
              onChange={(v) => patchPosting({ allowOpeningBalance: v })}
            />
            <CheckboxField
              id="coa-cc-req"
              label="Cost centre required on posting"
              checked={form.posting.costCentreRequired}
              onChange={(v) => patchPosting({ costCentreRequired: v })}
            />
            <CheckboxField
              id="coa-proj-req"
              label="Project required on posting"
              checked={form.posting.projectRequired}
              onChange={(v) => patchPosting({ projectRequired: v })}
            />
            <CheckboxField
              id="coa-dept-req"
              label="Department required on posting"
              checked={form.posting.departmentRequired}
              onChange={(v) => patchPosting({ departmentRequired: v })}
            />
            <CheckboxField
              id="coa-neg"
              label="Block negative balance"
              checked={form.posting.blockNegativeBalance}
              onChange={(v) => patchPosting({ blockNegativeBalance: v })}
            />
            <div>
              <FormLabel htmlFor="coa-currency" label="Currency" />
              <input
                id="coa-currency"
                value={form.posting.currency}
                onChange={(e) => patchPosting({ currency: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </div>
            <CheckboxField
              id="coa-desc-req"
              label="Posting description required"
              checked={form.posting.postingDescriptionRequired}
              onChange={(v) => patchPosting({ postingDescriptionRequired: v })}
            />
          </div>
        ) : null}

        {tab === 'posting' && isGroup ? (
          <p className="text-[12px] text-erp-muted">Group accounts cannot accept postings. Posting controls are not applicable.</p>
        ) : null}

        {tab === 'tax' ? (
          <div className="space-y-3">
            <CheckboxField
              id="coa-gst"
              label="GST relevant"
              checked={form.tax.gstRelevant}
              onChange={(v) => patchForm({ tax: { ...form.tax, gstRelevant: v } })}
            />
            {form.tax.gstRelevant ? (
              <div>
                <FormLabel htmlFor="coa-gst-type" label="GST account type" />
                <select
                  id="coa-gst-type"
                  value={form.tax.gstAccountType}
                  onChange={(e) =>
                    patchForm({ tax: { ...form.tax, gstAccountType: e.target.value as AccountFormInput['tax']['gstAccountType'] } })
                  }
                  className="erp-input h-9 w-full text-[12px]"
                >
                  {GST_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <CheckboxField
              id="coa-tds"
              label="TDS relevant"
              checked={form.tax.tdsRelevant}
              onChange={(v) => patchForm({ tax: { ...form.tax, tdsRelevant: v } })}
            />
            {form.tax.tdsRelevant ? (
              <div>
                <FormLabel htmlFor="coa-tds-type" label="TDS account type" />
                <select
                  id="coa-tds-type"
                  value={form.tax.tdsAccountType}
                  onChange={(e) =>
                    patchForm({ tax: { ...form.tax, tdsAccountType: e.target.value as AccountFormInput['tax']['tdsAccountType'] } })
                  }
                  className="erp-input h-9 w-full text-[12px]"
                >
                  {TDS_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <CheckboxField
              id="coa-tcs"
              label="TCS relevant"
              checked={form.tax.tcsRelevant}
              onChange={(v) => patchForm({ tax: { ...form.tax, tcsRelevant: v } })}
            />
            <CheckboxField
              id="coa-rcm"
              label="Reverse charge applicable"
              checked={form.tax.reverseChargeApplicable}
              onChange={(v) => patchForm({ tax: { ...form.tax, reverseChargeApplicable: v } })}
            />
            <CheckboxField
              id="coa-stat"
              label="Statutory account"
              checked={form.tax.statutoryAccount}
              onChange={(v) => patchForm({ tax: { ...form.tax, statutoryAccount: v } })}
            />
            <div>
              <FormLabel htmlFor="coa-compliance" label="Compliance notes" />
              <textarea
                id="coa-compliance"
                value={form.tax.complianceNotes}
                onChange={(e) => patchForm({ tax: { ...form.tax, complianceNotes: e.target.value } })}
                rows={2}
                className="erp-input w-full resize-y text-[12px]"
              />
            </div>
          </div>
        ) : null}

        {tab === 'manufacturing' ? (
          <div className="space-y-3">
            <CheckboxField
              id="coa-mfg"
              label="Manufacturing account"
              checked={form.manufacturing.manufacturingAccount}
              onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, manufacturingAccount: v } })}
            />
            {form.manufacturing.manufacturingAccount ? (
              <>
                <div>
                  <FormLabel htmlFor="coa-mfg-type" label="Manufacturing account type" />
                  <select
                    id="coa-mfg-type"
                    value={form.manufacturing.manufacturingAccountType}
                    onChange={(e) =>
                      patchForm({
                        manufacturing: {
                          ...form.manufacturing,
                          manufacturingAccountType: e.target.value as AccountFormInput['manufacturing']['manufacturingAccountType'],
                        },
                      })
                    }
                    className="erp-input h-9 w-full text-[12px]"
                  >
                    {MANUFACTURING_ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FormLabel htmlFor="coa-cost-el" label="Cost element type" />
                  <select
                    id="coa-cost-el"
                    value={form.manufacturing.costElementType ?? ''}
                    onChange={(e) =>
                      patchForm({
                        manufacturing: {
                          ...form.manufacturing,
                          costElementType: e.target.value ? (e.target.value as AccountFormInput['manufacturing']['costElementType']) : null,
                        },
                      })
                    }
                    className="erp-input h-9 w-full text-[12px]"
                  >
                    <option value="">—</option>
                    {COST_ELEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <CheckboxField
                  id="coa-inv-val"
                  label="Inventory valuation account"
                  checked={form.manufacturing.inventoryValuationAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, inventoryValuationAccount: v } })}
                />
                <CheckboxField
                  id="coa-cons"
                  label="Consumption account"
                  checked={form.manufacturing.consumptionAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, consumptionAccount: v } })}
                />
                <CheckboxField
                  id="coa-wip"
                  label="WIP account"
                  checked={form.manufacturing.wipAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, wipAccount: v } })}
                />
                <CheckboxField
                  id="coa-fg"
                  label="Finished goods account"
                  checked={form.manufacturing.finishedGoodsAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, finishedGoodsAccount: v } })}
                />
                <CheckboxField
                  id="coa-cogs"
                  label="COGS account"
                  checked={form.manufacturing.cogsAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, cogsAccount: v } })}
                />
                <CheckboxField
                  id="coa-pv"
                  label="Purchase variance account"
                  checked={form.manufacturing.purchaseVarianceAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, purchaseVarianceAccount: v } })}
                />
                <CheckboxField
                  id="coa-prv"
                  label="Production variance account"
                  checked={form.manufacturing.productionVarianceAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, productionVarianceAccount: v } })}
                />
                <CheckboxField
                  id="coa-scrap"
                  label="Scrap account"
                  checked={form.manufacturing.scrapAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, scrapAccount: v } })}
                />
                <CheckboxField
                  id="coa-oh"
                  label="Overhead account"
                  checked={form.manufacturing.overheadAccount}
                  onChange={(v) => patchForm({ manufacturing: { ...form.manufacturing, overheadAccount: v } })}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {tab === 'dimensions' ? (
          <div className="space-y-4">
            {(
              [
                ['costCentres', 'defaultCostCentreId', 'costCentreMandatory', 'Cost centre'] as const,
                ['departments', 'defaultDepartmentId', 'departmentMandatory', 'Department'] as const,
                ['projects', 'defaultProjectId', 'projectMandatory', 'Project'] as const,
                ['plants', 'defaultPlantId', 'plantMandatory', 'Plant'] as const,
                ['locations', 'defaultLocationId', 'locationMandatory', 'Location'] as const,
              ] as const
            ).map(([lookupKey, defaultKey, mandatoryKey, label]) => (
              <div key={lookupKey} className="grid gap-2 sm:grid-cols-2">
                <div>
                  <FormLabel htmlFor={`coa-dim-${lookupKey}`} label={`Default ${label.toLowerCase()}`} />
                  <select
                    id={`coa-dim-${lookupKey}`}
                    value={form.dimensions[defaultKey] ?? ''}
                    onChange={(e) =>
                      patchForm({
                        dimensions: { ...form.dimensions, [defaultKey]: e.target.value || null },
                      })
                    }
                    className="erp-input h-9 w-full text-[12px]"
                  >
                    <option value="">—</option>
                    {dimensionLookups[lookupKey].map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.code} — {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <CheckboxField
                    id={`coa-dim-mand-${lookupKey}`}
                    label={`${label} mandatory`}
                    checked={form.dimensions[mandatoryKey]}
                    onChange={(v) => patchForm({ dimensions: { ...form.dimensions, [mandatoryKey]: v } })}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'audit' && mode === 'edit' && account ? (
          <div className="space-y-2 text-[12px]">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <span className="text-erp-muted">Created by</span>
              <span className="font-medium">{account.createdBy}</span>
              <span className="text-erp-muted">Created</span>
              <span>{formatDateTime(account.createdAt)}</span>
              <span className="text-erp-muted">Modified by</span>
              <span className="font-medium">{account.modifiedBy}</span>
              <span className="text-erp-muted">Modified</span>
              <span>{formatDateTime(account.modifiedAt)}</span>
              {account.deactivatedReason ? (
                <>
                  <span className="text-erp-muted">Deactivation reason</span>
                  <span>{account.deactivatedReason}</span>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>
    </AccountDrawerShell>
  )
}
