import { useEffect, useState } from 'react'
import { Input, Select } from '@/components/forms/Inputs'
import { listAccounts } from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import type { TransferAccountSnapshot } from '../../transfers/api/treasury-transfer.types'
import { ADJUSTMENT_TYPE_OPTIONS, todayIsoDate } from '../utils/format'
import { AdjustmentLineEditor, emptyAdjustmentLine } from './AdjustmentLineEditor'
import type { AdjustmentLineInput, CreateAdjustmentInput, TreasuryAdjustmentDirection, TreasuryAdjustmentType } from '../api/treasury-adjustment.types'

export interface AdjustmentFormValues {
  treasuryAccountId: string
  adjustmentType: TreasuryAdjustmentType
  direction: TreasuryAdjustmentDirection | ''
  adjustmentDate: string
  currencyCode: string
  narration: string
  internalNote: string
  lines: AdjustmentLineInput[]
}

export const EMPTY_ADJUSTMENT_FORM: AdjustmentFormValues = {
  treasuryAccountId: '',
  adjustmentType: 'BANK_CHARGES',
  direction: '',
  adjustmentDate: todayIsoDate(),
  currencyCode: 'INR',
  narration: '',
  internalNote: '',
  lines: [emptyAdjustmentLine()],
}

export function buildCreateAdjustmentPayload(values: AdjustmentFormValues, legalEntityId: string): CreateAdjustmentInput {
  return {
    legalEntityId,
    treasuryAccountId: values.treasuryAccountId,
    adjustmentType: values.adjustmentType,
    direction: values.direction || null,
    adjustmentDate: values.adjustmentDate,
    currencyCode: values.currencyCode || 'INR',
    narration: values.narration || null,
    internalNote: values.internalNote || null,
    lines: values.lines,
  }
}

export function AdjustmentForm({
  values,
  onChange,
  accounts,
  accountsLoading,
  legalEntityId,
  disabled,
  fieldErrors,
}: {
  values: AdjustmentFormValues
  onChange: (next: AdjustmentFormValues) => void
  accounts: TransferAccountSnapshot[]
  accountsLoading: boolean
  legalEntityId: string | undefined
  disabled?: boolean
  fieldErrors?: Partial<Record<string, string>>
}) {
  const [glAccounts, setGlAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (!legalEntityId) return
    listAccounts(legalEntityId)
      .then((res) => setGlAccounts(res.filter((a) => a.isActive && !a.isGroup)))
      .catch(() => setGlAccounts([]))
  }, [legalEntityId])

  const set = <K extends keyof AdjustmentFormValues>(key: K, value: AdjustmentFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  const errorText = (key: string) => fieldErrors?.[key]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Adjustment details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Bank account</label>
            <Select
              className="h-9 text-[13px]"
              value={values.treasuryAccountId}
              disabled={disabled || accountsLoading}
              aria-label="Bank account"
              onChange={(e) => set('treasuryAccountId', e.target.value)}
            >
              <option value="">Select bank accountâ€¦</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} â€” {a.name}
                </option>
              ))}
            </Select>
            {errorText('treasuryAccountId') ? <p className="text-[11px] text-rose-600">{errorText('treasuryAccountId')}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Adjustment type</label>
            <Select
              className="h-9 text-[13px]"
              value={values.adjustmentType}
              disabled={disabled}
              onChange={(e) => set('adjustmentType', e.target.value as TreasuryAdjustmentType)}
            >
              {ADJUSTMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Direction override</label>
            <Select
              className="h-9 text-[13px]"
              value={values.direction}
              disabled={disabled}
              onChange={(e) => set('direction', e.target.value as TreasuryAdjustmentDirection | '')}
            >
              <option value="">Auto (derived from adjustment type)</option>
              <option value="BANK_DEBIT">Bank Debit (money out)</option>
              <option value="BANK_CREDIT">Bank Credit (money in)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Adjustment date</label>
            <Input type="date" value={values.adjustmentDate} disabled={disabled} onChange={(e) => set('adjustmentDate', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Currency</label>
            <Input
              value={values.currencyCode}
              disabled={disabled}
              onChange={(e) => set('currencyCode', e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Narration</label>
            <textarea
              className="erp-input text-[13px]"
              rows={2}
              placeholder="Purpose / description of this adjustment"
              value={values.narration}
              disabled={disabled}
              onChange={(e) => set('narration', e.target.value)}
            />
            {errorText('narration') ? <p className="text-[11px] text-rose-600">{errorText('narration')}</p> : null}
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Internal note</label>
            <textarea
              className="erp-input text-[13px]"
              rows={2}
              placeholder="Internal note (not shown externally)"
              value={values.internalNote}
              disabled={disabled}
              onChange={(e) => set('internalNote', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Offset lines</h3>
        {errorText('lines') ? <p className="mb-2 text-[11px] text-rose-600">{errorText('lines')}</p> : null}
        <AdjustmentLineEditor lines={values.lines} onChange={(lines) => set('lines', lines)} glAccounts={glAccounts} disabled={disabled} />
      </section>
    </div>
  )
}
