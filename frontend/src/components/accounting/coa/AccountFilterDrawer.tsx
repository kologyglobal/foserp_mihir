import { AccountDrawerShell } from './AccountDrawerShell'
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  type AccountFilter,
  type ChartOfAccount,
} from '@/types/chartOfAccounts'

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-[12px] font-semibold text-erp-text">{label}</label>
      {children}
    </div>
  )
}

function YesNoSelect({
  value,
  onChange,
}: {
  value: '' | 'yes' | 'no'
  onChange: (value: '' | 'yes' | 'no') => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as '' | 'yes' | 'no')}
      className="erp-input h-9 w-full text-[12px]"
    >
      <option value="">Any</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  )
}

export function AccountFilterDrawer({
  open,
  onClose,
  filter,
  onChange,
  onApply,
  onReset,
  onSaveView,
  accounts,
}: {
  open: boolean
  onClose: () => void
  filter: AccountFilter
  onChange: (filter: AccountFilter) => void
  onApply: () => void
  onReset: () => void
  onSaveView?: () => void
  accounts: ChartOfAccount[]
}) {
  const groupParents = accounts
    .filter((a) => a.accountType === 'Group')
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  function patch(partial: Partial<AccountFilter>) {
    onChange({ ...filter, ...partial })
  }

  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      eyebrow="Filters"
      title="Filter accounts"
      subtitle="Narrow the chart of accounts list"
      widthClassName="max-w-sm"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold" onClick={onReset}>
              Reset
            </button>
            {onSaveView ? (
              <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold" onClick={onSaveView}>
                Save view
              </button>
            ) : null}
          </div>
          <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold" onClick={onApply}>
            Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FilterField label="Category">
          <select
            value={filter.category}
            onChange={(e) => patch({ category: e.target.value as AccountFilter['category'] })}
            className="erp-input h-9 w-full text-[12px]"
          >
            <option value="">Any category</option>
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Account type">
          <select
            value={filter.accountType}
            onChange={(e) => patch({ accountType: e.target.value as AccountFilter['accountType'] })}
            className="erp-input h-9 w-full text-[12px]"
          >
            <option value="">Any type</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Parent account">
          <select
            value={filter.parentId}
            onChange={(e) => patch({ parentId: e.target.value })}
            className="erp-input h-9 w-full text-[12px]"
          >
            <option value="">Any parent</option>
            {groupParents.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Normal balance">
          <select
            value={filter.normalBalance}
            onChange={(e) => patch({ normalBalance: e.target.value as AccountFilter['normalBalance'] })}
            className="erp-input h-9 w-full text-[12px]"
          >
            <option value="">Any</option>
            {NORMAL_BALANCES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Direct posting">
          <YesNoSelect value={filter.directPosting} onChange={(v) => patch({ directPosting: v })} />
        </FilterField>

        <FilterField label="Control account">
          <YesNoSelect value={filter.controlAccount} onChange={(v) => patch({ controlAccount: v })} />
        </FilterField>

        <FilterField label="Status">
          <select
            value={filter.activeStatus}
            onChange={(e) => patch({ activeStatus: e.target.value as AccountFilter['activeStatus'] })}
            className="erp-input h-9 w-full text-[12px]"
          >
            <option value="">Any status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </FilterField>

        <FilterField label="GST relevant">
          <YesNoSelect value={filter.gstRelevant} onChange={(v) => patch({ gstRelevant: v })} />
        </FilterField>

        <FilterField label="TDS relevant">
          <YesNoSelect value={filter.tdsRelevant} onChange={(v) => patch({ tdsRelevant: v })} />
        </FilterField>

        <FilterField label="Reconciliation required">
          <YesNoSelect value={filter.reconciliationRequired} onChange={(v) => patch({ reconciliationRequired: v })} />
        </FilterField>

        <FilterField label="Cost centre required">
          <YesNoSelect value={filter.costCentreRequired} onChange={(v) => patch({ costCentreRequired: v })} />
        </FilterField>

        <FilterField label="Has balance">
          <YesNoSelect value={filter.hasBalance} onChange={(v) => patch({ hasBalance: v })} />
        </FilterField>

        <FilterField label="Created by">
          <input
            type="text"
            value={filter.createdBy}
            onChange={(e) => patch({ createdBy: e.target.value })}
            className="erp-input h-9 w-full text-[12px]"
            placeholder="User name contains…"
          />
        </FilterField>

        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Created from">
            <input
              type="date"
              value={filter.createdDateFrom}
              onChange={(e) => patch({ createdDateFrom: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Created to">
            <input
              type="date"
              value={filter.createdDateTo}
              onChange={(e) => patch({ createdDateTo: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
        </div>
      </div>
    </AccountDrawerShell>
  )
}
