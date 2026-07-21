import { Select } from '@/components/forms/Inputs'
import { formatCurrency } from '@/utils/formatters/currency'
import type { TransferAccountSnapshot } from '../api/treasury-transfer.types'
import { maskAccountNumber, parseDecimal } from '../utils/treasuryTransferUi'

export function TreasuryAccountSelector({
  label,
  accounts,
  value,
  onChange,
  excludeId,
  disabled,
  placeholder = 'Select account…',
  'aria-label': ariaLabel,
}: {
  label?: string
  accounts: TransferAccountSnapshot[]
  value: string
  onChange: (accountId: string) => void
  /** Excludes the account already selected on the opposite side (source ≠ destination). */
  excludeId?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const options = accounts.filter((a) => a.id !== excludeId)
  const selected = accounts.find((a) => a.id === value)

  return (
    <div className="flex flex-col gap-1">
      {label ? <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</label> : null}
      <Select
        className="h-9 text-[13px]"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.accountType} · {a.code} — {a.name}
            {a.accountType === 'BANK' && a.maskedNumber ? ` (${maskAccountNumber(a.maskedNumber)})` : ''}
          </option>
        ))}
      </Select>
      {selected ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-erp-muted">
          {selected.accountType === 'BANK' ? (
            <span>Account: {maskAccountNumber(selected.maskedNumber)}</span>
          ) : null}
          {selected.bankName ? <span>{selected.bankName}</span> : null}
          <span>Currency: {selected.currencyCode}</span>
          {selected.bookBalance != null ? (
            <span className="font-medium text-erp-text">Book balance: {formatCurrency(parseDecimal(selected.bookBalance))}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
