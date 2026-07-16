import type { ReactNode } from 'react'
import { LedgerDrawerShell } from './LedgerDrawerShell'
import {
  LEDGER_ENTRY_STATUSES,
  LEDGER_PARTY_TYPES,
  LEDGER_VOUCHER_TYPES,
  MANUFACTURING_LEDGER_ACCOUNT_TYPES,
  type LedgerEntryFilter,
  type LedgerPartyType,
  type LedgerVoucherType,
  type ManufacturingLedgerAccountType,
} from '@/types/ledgerEntries'

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-erp-border pb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
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

export type LedgerLookups = Awaited<
  ReturnType<typeof import('@/services/accounting/ledgerEntriesService').getLedgerLookups>
>

export function LedgerFilterDrawer({
  open,
  onClose,
  filter,
  onChange,
  onApply,
  onReset,
  onSaveView,
  lookups,
}: {
  open: boolean
  onClose: () => void
  filter: LedgerEntryFilter
  onChange: (filter: LedgerEntryFilter) => void
  onApply: () => void
  onReset: () => void
  onSaveView?: () => void
  lookups: LedgerLookups
}) {
  function patch(partial: Partial<LedgerEntryFilter>) {
    onChange({ ...filter, ...partial })
  }

  return (
    <LedgerDrawerShell
      open={open}
      onClose={onClose}
      eyebrow="Filters"
      title="Filter ledger entries"
      subtitle="Advanced criteria for the general ledger register"
      widthClassName="max-w-md"
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
          <div className="flex gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold" onClick={onApply}>
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <FilterSection title="Document">
          <FilterField label="Entry number">
            <input
              type="text"
              value={filter.entryNumber}
              onChange={(e) => patch({ entryNumber: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
              placeholder="Contains…"
            />
          </FilterField>
          <FilterField label="Voucher number">
            <input
              type="text"
              value={filter.voucherNumber}
              onChange={(e) => patch({ voucherNumber: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
              placeholder="Contains…"
            />
          </FilterField>
          <FilterField label="Voucher type">
            <select
              value={filter.voucherType}
              onChange={(e) => patch({ voucherType: e.target.value as LedgerVoucherType | '' })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any type</option>
              {LEDGER_VOUCHER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Entry status">
            <select
              value={filter.entryStatus}
              onChange={(e) => patch({ entryStatus: e.target.value as LedgerEntryFilter['entryStatus'] })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any status</option>
              {LEDGER_ENTRY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Posting from">
              <input
                type="date"
                value={filter.postingDateFrom}
                onChange={(e) => patch({ postingDateFrom: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
            <FilterField label="Posting to">
              <input
                type="date"
                value={filter.postingDateTo}
                onChange={(e) => patch({ postingDateTo: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Document from">
              <input
                type="date"
                value={filter.documentDateFrom}
                onChange={(e) => patch({ documentDateFrom: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
            <FilterField label="Document to">
              <input
                type="date"
                value={filter.documentDateTo}
                onChange={(e) => patch({ documentDateTo: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
          </div>
          <FilterField label="Include preview entries">
            <label className="flex items-center gap-2 text-[12px] text-erp-text">
              <input
                type="checkbox"
                checked={filter.includePreview}
                onChange={(e) => patch({ includePreview: e.target.checked })}
                className="rounded border-erp-border"
              />
              Show preview-only rows
            </label>
          </FilterField>
        </FilterSection>

        <FilterSection title="Account">
          <FilterField label="Account code">
            <input
              type="text"
              value={filter.accountCode}
              onChange={(e) => patch({ accountCode: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
              placeholder="Starts with…"
            />
          </FilterField>
          <FilterField label="Account name">
            <input
              type="text"
              value={filter.accountName}
              onChange={(e) => patch({ accountName: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
              placeholder="Contains…"
            />
          </FilterField>
          <FilterField label="Category">
            <select
              value={filter.accountCategory}
              onChange={(e) => patch({ accountCategory: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any category</option>
              {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Account type">
            <select
              value={filter.accountType}
              onChange={(e) => patch({ accountType: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any type</option>
              <option value="Group">Group</option>
              <option value="Posting">Posting</option>
            </select>
          </FilterField>
          <FilterField label="Normal balance">
            <select
              value={filter.normalBalance}
              onChange={(e) => patch({ normalBalance: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any</option>
              <option value="Debit">Debit</option>
              <option value="Credit">Credit</option>
            </select>
          </FilterField>
        </FilterSection>

        <FilterSection title="Party">
          <FilterField label="Party type">
            <select
              value={filter.partyType}
              onChange={(e) => patch({ partyType: e.target.value as LedgerPartyType | '' })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any type</option>
              {LEDGER_PARTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Party">
            <select
              value={filter.partyId}
              onChange={(e) => patch({ partyId: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any party</option>
              {lookups.parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Party name">
            <input
              type="text"
              value={filter.partyName}
              onChange={(e) => patch({ partyName: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
              placeholder="Contains…"
            />
          </FilterField>
        </FilterSection>

        <FilterSection title="Organization">
          <FilterField label="Cost centre">
            <select
              value={filter.costCentreId}
              onChange={(e) => patch({ costCentreId: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any cost centre</option>
              {lookups.costCentres.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code} — {cc.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Department">
            <select
              value={filter.departmentId}
              onChange={(e) => patch({ departmentId: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any department</option>
              {lookups.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Project">
            <select
              value={filter.projectId}
              onChange={(e) => patch({ projectId: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any project</option>
              {lookups.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Plant">
            <select
              value={filter.plantId}
              onChange={(e) => patch({ plantId: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any plant</option>
              {lookups.plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Business unit">
            <input
              type="text"
              value={filter.businessUnit}
              onChange={(e) => patch({ businessUnit: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
        </FilterSection>

        <FilterSection title="Manufacturing">
          <FilterField label="Production order">
            <input
              type="text"
              value={filter.productionOrder}
              onChange={(e) => patch({ productionOrder: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Work centre">
            <input
              type="text"
              value={filter.workCentre}
              onChange={(e) => patch({ workCentre: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Item code">
            <input
              type="text"
              value={filter.itemCode}
              onChange={(e) => patch({ itemCode: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Batch number">
            <input
              type="text"
              value={filter.batchNumber}
              onChange={(e) => patch({ batchNumber: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Manufacturing account type">
            <select
              value={filter.manufacturingAccountType}
              onChange={(e) =>
                patch({ manufacturingAccountType: e.target.value as ManufacturingLedgerAccountType | '' })
              }
              className="erp-input h-9 w-full text-[12px]"
            >
              <option value="">Any type</option>
              {MANUFACTURING_LEDGER_ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterSection>

        <FilterSection title="Audit">
          <FilterField label="Created by">
            <input
              type="text"
              value={filter.createdBy}
              onChange={(e) => patch({ createdBy: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Posted by">
            <input
              type="text"
              value={filter.postedBy}
              onChange={(e) => patch({ postedBy: e.target.value })}
              className="erp-input h-9 w-full text-[12px]"
            />
          </FilterField>
          <FilterField label="Has attachments">
            <YesNoSelect value={filter.hasAttachments} onChange={(v) => patch({ hasAttachments: v })} />
          </FilterField>
          <FilterField label="Has source document">
            <YesNoSelect value={filter.hasSourceDocument} onChange={(v) => patch({ hasSourceDocument: v })} />
          </FilterField>
          <FilterField label="Has reversal">
            <YesNoSelect value={filter.hasReversal} onChange={(v) => patch({ hasReversal: v })} />
          </FilterField>
          <FilterField label="Is reversal entry">
            <YesNoSelect value={filter.isReversalEntry} onChange={(v) => patch({ isReversalEntry: v })} />
          </FilterField>
        </FilterSection>

        <FilterSection title="Amount">
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Debit from">
              <input
                type="text"
                inputMode="decimal"
                value={filter.debitFrom}
                onChange={(e) => patch({ debitFrom: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
            <FilterField label="Debit to">
              <input
                type="text"
                inputMode="decimal"
                value={filter.debitTo}
                onChange={(e) => patch({ debitTo: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Credit from">
              <input
                type="text"
                inputMode="decimal"
                value={filter.creditFrom}
                onChange={(e) => patch({ creditFrom: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
            <FilterField label="Credit to">
              <input
                type="text"
                inputMode="decimal"
                value={filter.creditTo}
                onChange={(e) => patch({ creditTo: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Absolute from">
              <input
                type="text"
                inputMode="decimal"
                value={filter.absoluteAmountFrom}
                onChange={(e) => patch({ absoluteAmountFrom: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
            <FilterField label="Absolute to">
              <input
                type="text"
                inputMode="decimal"
                value={filter.absoluteAmountTo}
                onChange={(e) => patch({ absoluteAmountTo: e.target.value })}
                className="erp-input h-9 w-full text-[12px]"
              />
            </FilterField>
          </div>
          <FilterField label="Has balance impact">
            <YesNoSelect value={filter.hasBalanceImpact} onChange={(v) => patch({ hasBalanceImpact: v })} />
          </FilterField>
        </FilterSection>
      </div>
    </LedgerDrawerShell>
  )
}
