import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import type {
  VendorPaymentAdjustmentAccountingRole,
  VendorPaymentAdjustmentType,
} from '@/types/moneyOut'

export interface FormAdjustment {
  adjustmentType: VendorPaymentAdjustmentType
  accountingRole: VendorPaymentAdjustmentAccountingRole
  description: string
  amount: string
  rate: string
  calculationBaseAmount: string
  sectionCode: string
}

const ADJUSTMENT_TYPES: Array<{ value: VendorPaymentAdjustmentType; label: string }> = [
  { value: 'TDS', label: 'TDS' },
  { value: 'DISCOUNT', label: 'Discount received' },
  { value: 'RETENTION', label: 'Retention' },
  { value: 'WITHHOLDING', label: 'Withholding' },
  { value: 'BANK_CHARGE', label: 'Bank charge' },
  { value: 'PROCESSING_CHARGE', label: 'Processing charge' },
  { value: 'ROUND_OFF', label: 'Round off' },
  { value: 'OTHER', label: 'Other' },
]

const ROLES: Array<{ value: VendorPaymentAdjustmentAccountingRole; label: string }> = [
  { value: 'SETTLEMENT_CREDIT', label: 'Settlement credit (reduces liability)' },
  { value: 'PAYMENT_EXPENSE_DEBIT', label: 'Payment expense (company cost)' },
  { value: 'ROUND_OFF_DEBIT', label: 'Round-off debit' },
  { value: 'ROUND_OFF_CREDIT', label: 'Round-off credit' },
  { value: 'INFORMATION_ONLY', label: 'Information only' },
]

/** Sensible default accounting role + description by adjustment type. */
export function defaultAdjustment(type: VendorPaymentAdjustmentType): FormAdjustment {
  const base: Omit<FormAdjustment, 'adjustmentType' | 'accountingRole' | 'description'> = {
    amount: '',
    rate: '',
    calculationBaseAmount: '',
    sectionCode: '',
  }
  switch (type) {
    case 'TDS':
      return { ...base, adjustmentType: 'TDS', accountingRole: 'SETTLEMENT_CREDIT', description: 'TDS' }
    case 'DISCOUNT':
      return { ...base, adjustmentType: 'DISCOUNT', accountingRole: 'SETTLEMENT_CREDIT', description: 'Discount received' }
    case 'RETENTION':
      return { ...base, adjustmentType: 'RETENTION', accountingRole: 'SETTLEMENT_CREDIT', description: 'Retention' }
    case 'WITHHOLDING':
      return { ...base, adjustmentType: 'WITHHOLDING', accountingRole: 'SETTLEMENT_CREDIT', description: 'Withholding' }
    case 'BANK_CHARGE':
      return { ...base, adjustmentType: 'BANK_CHARGE', accountingRole: 'PAYMENT_EXPENSE_DEBIT', description: 'Bank charges' }
    case 'PROCESSING_CHARGE':
      return {
        ...base,
        adjustmentType: 'PROCESSING_CHARGE',
        accountingRole: 'PAYMENT_EXPENSE_DEBIT',
        description: 'Processing charges',
      }
    case 'ROUND_OFF':
      return { ...base, adjustmentType: 'ROUND_OFF', accountingRole: 'ROUND_OFF_CREDIT', description: 'Round off' }
    case 'OTHER':
    default:
      return { ...base, adjustmentType: 'OTHER', accountingRole: 'SETTLEMENT_CREDIT', description: 'Other adjustment' }
  }
}

/**
 * Controlled adjustment editor. Adjustment amounts/rates are raw inputs — the server calculates
 * the settlement/cash-outflow impact. `amount` is optional when a `rate` is provided (e.g. TDS %).
 */
export function VendorPaymentAdjustmentSection({
  value,
  onChange,
  disabled,
}: {
  value: FormAdjustment[]
  onChange: (next: FormAdjustment[]) => void
  disabled?: boolean
}) {
  const update = (index: number, patch: Partial<FormAdjustment>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index))
  const add = () => onChange([...value, defaultAdjustment('TDS')])

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Adjustments</h3>
        <ErpButton type="button" variant="secondary" size="sm" onClick={add} disabled={disabled}>
          Add adjustment
        </ErpButton>
      </div>

      {value.length === 0 ? (
        <p className="text-[12px] text-erp-muted">
          No adjustments. Add TDS, discount, retention, or bank charges — the server recalculates settlement and cash
          outflow.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => (
            <div key={index} className="grid gap-2 rounded border border-erp-border p-2 lg:grid-cols-12">
              <div className="lg:col-span-2">
                <Select
                  aria-label={`Adjustment ${index + 1} type`}
                  value={row.adjustmentType}
                  disabled={disabled}
                  onChange={(e) => {
                    const type = e.target.value as VendorPaymentAdjustmentType
                    const preset = defaultAdjustment(type)
                    update(index, { adjustmentType: type, accountingRole: preset.accountingRole, description: preset.description })
                  }}
                >
                  {ADJUSTMENT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="lg:col-span-3">
                <Input
                  placeholder="Description"
                  value={row.description}
                  disabled={disabled}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </div>
              <div className="lg:col-span-2">
                <Select
                  aria-label={`Adjustment ${index + 1} role`}
                  value={row.accountingRole}
                  disabled={disabled}
                  onChange={(e) => update(index, { accountingRole: e.target.value as VendorPaymentAdjustmentAccountingRole })}
                >
                  {ROLES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Input
                  placeholder="Amount"
                  value={row.amount}
                  disabled={disabled}
                  onChange={(e) => update(index, { amount: e.target.value })}
                />
              </div>
              <div className="lg:col-span-1">
                <Input
                  placeholder="Rate %"
                  value={row.rate}
                  disabled={disabled}
                  onChange={(e) => update(index, { rate: e.target.value })}
                />
              </div>
              <div className="lg:col-span-1">
                <Input
                  placeholder="Sec."
                  value={row.sectionCode}
                  disabled={disabled}
                  onChange={(e) => update(index, { sectionCode: e.target.value })}
                />
              </div>
              <div className="flex items-center lg:col-span-1">
                <ErpButton type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={disabled}>
                  Remove
                </ErpButton>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-erp-muted">
        Raw adjustment inputs are sent to the server. Settlement and cash-outflow impacts are calculated by the API.
      </p>
    </section>
  )
}
