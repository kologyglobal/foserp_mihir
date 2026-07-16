import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { Input, Select } from '@/components/forms/Inputs'
import type { VoucherDocumentType, VoucherFilter, VoucherLifecycleStatus, VoucherPartyOption } from '@/types/vouchers'
import {
  DEFAULT_VOUCHER_FILTER,
  VOUCHER_DOCUMENT_TYPE_LABELS,
  VOUCHER_DOCUMENT_TYPES,
  VOUCHER_LIFECYCLE_LABELS,
  VOUCHER_LIFECYCLE_STATUSES,
} from '@/types/vouchers'

export function VoucherFilterDrawer({
  open,
  onClose,
  value,
  onChange,
  parties,
  onApply,
  onReset,
}: {
  open: boolean
  onClose: () => void
  value: VoucherFilter
  onChange: (next: VoucherFilter) => void
  parties: VoucherPartyOption[]
  onApply: () => void
  onReset: () => void
}) {
  const set = <K extends keyof VoucherFilter>(key: K, v: VoucherFilter[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow the voucher register"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" onClick={onApply}>
            Apply
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block text-[12px] font-medium text-erp-text">
          Voucher type
          <Select
            className="mt-1"
            value={value.voucherType}
            onChange={(e) => set('voucherType', e.target.value as VoucherDocumentType | 'all')}
          >
            <option value="all">All types</option>
            {VOUCHER_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {VOUCHER_DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[12px] font-medium text-erp-text">
          Status
          <Select
            className="mt-1"
            value={value.status}
            onChange={(e) => set('status', e.target.value as VoucherLifecycleStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {VOUCHER_LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VOUCHER_LIFECYCLE_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] font-medium text-erp-text">
            From
            <Input type="date" className="mt-1" value={value.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
          </label>
          <label className="block text-[12px] font-medium text-erp-text">
            To
            <Input type="date" className="mt-1" value={value.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
          </label>
        </div>
        <label className="block text-[12px] font-medium text-erp-text">
          Party
          <Select className="mt-1" value={value.partyId} onChange={(e) => set('partyId', e.target.value)}>
            <option value="">All parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[12px] font-medium text-erp-text">
          Created by
          <Input className="mt-1" value={value.createdBy} onChange={(e) => set('createdBy', e.target.value)} placeholder="Name contains…" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] font-medium text-erp-text">
            Min amount
            <Input className="mt-1" inputMode="decimal" value={value.minAmount} onChange={(e) => set('minAmount', e.target.value)} />
          </label>
          <label className="block text-[12px] font-medium text-erp-text">
            Max amount
            <Input className="mt-1" inputMode="decimal" value={value.maxAmount} onChange={(e) => set('maxAmount', e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-medium text-erp-text">
          <input
            type="checkbox"
            checked={value.unbalancedOnly}
            onChange={(e) => set('unbalancedOnly', e.target.checked)}
          />
          Unbalanced drafts only
        </label>
      </div>
      <p className="mt-4 text-[11px] text-erp-muted">
        Defaults match <code className="text-[10px]">DEFAULT_VOUCHER_FILTER</code> ({DEFAULT_VOUCHER_FILTER.listTab}).
      </p>
    </AccountDrawerShell>
  )
}
