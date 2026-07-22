import { useEffect, useState } from 'react'
import { Input, Select } from '@/components/forms/Inputs'
import { listAccounts } from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import type { TransferAccountSnapshot } from '../../transfers/api/treasury-transfer.types'
import type {
  CreateStandingInstructionInput,
  StandingInstructionAmountMode,
  StandingInstructionFrequency,
} from '../api/standing-instruction.types'
import type {
  GstTreatment,
  TdsTreatment,
  TreasuryAdjustmentDirection,
  TreasuryAdjustmentLineType,
  TreasuryAdjustmentType,
} from '../../adjustments/api/treasury-adjustment.types'
import {
  ADJUSTMENT_LINE_TYPE_OPTIONS,
  ADJUSTMENT_TYPE_OPTIONS,
  GST_TREATMENT_OPTIONS,
  TDS_TREATMENT_OPTIONS,
} from '../../adjustments/utils/treasuryAdjustmentUi'
import { SI_AMOUNT_MODE_LABELS, SI_FREQUENCY_OPTIONS } from '../utils/standingInstructionUi'
import { todayIsoDate } from '../utils/format'

export interface SIFormValues {
  treasuryAccountId: string
  name: string
  description: string
  adjustmentType: TreasuryAdjustmentType
  direction: TreasuryAdjustmentDirection
  frequency: StandingInstructionFrequency
  amountMode: StandingInstructionAmountMode
  fixedAmount: string
  startDate: string
  endDate: string
  narrationTemplate: string
  lineType: TreasuryAdjustmentLineType
  accountId: string
  lineDescription: string
  gstTreatment: GstTreatment
  gstRate: string
  gstAccountId: string
  tdsTreatment: TdsTreatment
  tdsRate: string
  tdsAccountId: string
}

export const EMPTY_SI_FORM: SIFormValues = {
  treasuryAccountId: '',
  name: '',
  description: '',
  adjustmentType: 'BANK_CHARGES',
  direction: 'BANK_DEBIT',
  frequency: 'MONTHLY',
  amountMode: 'FIXED',
  fixedAmount: '',
  startDate: todayIsoDate(),
  endDate: '',
  narrationTemplate: '',
  lineType: 'EXPENSE',
  accountId: '',
  lineDescription: '',
  gstTreatment: 'GST_NOT_APPLICABLE',
  gstRate: '',
  gstAccountId: '',
  tdsTreatment: 'TDS_NOT_APPLICABLE',
  tdsRate: '',
  tdsAccountId: '',
}

export function buildCreateSiPayload(values: SIFormValues, legalEntityId: string): CreateStandingInstructionInput {
  return {
    legalEntityId,
    treasuryAccountId: values.treasuryAccountId,
    name: values.name,
    description: values.description || null,
    adjustmentType: values.adjustmentType,
    direction: values.direction,
    frequency: values.frequency,
    amountMode: values.amountMode,
    fixedAmount: values.amountMode === 'FIXED' ? values.fixedAmount : null,
    startDate: values.startDate,
    endDate: values.endDate || null,
    narrationTemplate: values.narrationTemplate || null,
    lineTemplate: {
      lineType: values.lineType,
      accountId: values.accountId || null,
      description: values.lineDescription || null,
      gstTreatment: values.gstTreatment,
      gstRate: values.gstRate || null,
      gstAccountId: values.gstAccountId || null,
      tdsTreatment: values.tdsTreatment,
      tdsRate: values.tdsRate || null,
      tdsAccountId: values.tdsAccountId || null,
    },
  }
}

export function SIForm({
  values,
  onChange,
  accounts,
  accountsLoading,
  legalEntityId,
  disabled,
  fieldErrors,
}: {
  values: SIFormValues
  onChange: (next: SIFormValues) => void
  accounts: TransferAccountSnapshot[]
  accountsLoading: boolean
  legalEntityId: string | undefined
  disabled?: boolean
  fieldErrors?: Partial<Record<'treasuryAccountId' | 'name' | 'accountId' | 'fixedAmount', string>>
}) {
  const [glAccounts, setGlAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (!legalEntityId) return
    listAccounts(legalEntityId)
      .then((res) => setGlAccounts(res.filter((a) => a.isActive && !a.isGroup)))
      .catch(() => setGlAccounts([]))
  }, [legalEntityId])

  const set = <K extends keyof SIFormValues>(key: K, value: SIFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Standing instruction details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Name</label>
            <Input
              placeholder="e.g. Monthly bank AMC charge"
              value={values.name}
              disabled={disabled}
              error={Boolean(fieldErrors?.name)}
              onChange={(e) => set('name', e.target.value)}
            />
            {fieldErrors?.name ? <p className="text-[11px] text-rose-600">{fieldErrors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Bank account</label>
            <Select
              className="h-9 text-[13px]"
              value={values.treasuryAccountId}
              disabled={disabled || accountsLoading}
              onChange={(e) => set('treasuryAccountId', e.target.value)}
            >
              <option value="">Select bank account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
            {fieldErrors?.treasuryAccountId ? <p className="text-[11px] text-rose-600">{fieldErrors.treasuryAccountId}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Transaction type</label>
            <Select
              className="h-9 text-[13px]"
              value={values.adjustmentType}
              disabled={disabled}
              onChange={(e) => set('adjustmentType', e.target.value as TreasuryAdjustmentType)}
            >
              {ADJUSTMENT_TYPE_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Direction</label>
            <Select
              className="h-9 text-[13px]"
              value={values.direction}
              disabled={disabled}
              onChange={(e) => set('direction', e.target.value as TreasuryAdjustmentDirection)}
            >
              <option value="BANK_DEBIT">Bank Debit (Money Out)</option>
              <option value="BANK_CREDIT">Bank Credit (Money In)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Frequency</label>
            <Select
              className="h-9 text-[13px]"
              value={values.frequency}
              disabled={disabled}
              onChange={(e) => set('frequency', e.target.value as StandingInstructionFrequency)}
            >
              {SI_FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Amount mode</label>
            <Select
              className="h-9 text-[13px]"
              value={values.amountMode}
              disabled={disabled}
              onChange={(e) => set('amountMode', e.target.value as StandingInstructionAmountMode)}
            >
              {Object.entries(SI_AMOUNT_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {values.amountMode === 'FIXED' ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Fixed amount</label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={values.fixedAmount}
                disabled={disabled}
                error={Boolean(fieldErrors?.fixedAmount)}
                onChange={(e) => set('fixedAmount', e.target.value)}
              />
              {fieldErrors?.fixedAmount ? <p className="text-[11px] text-rose-600">{fieldErrors.fixedAmount}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Start date</label>
            <Input type="date" value={values.startDate} disabled={disabled} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">End date (optional)</label>
            <Input type="date" value={values.endDate} disabled={disabled} onChange={(e) => set('endDate', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Narration template</label>
            <Input
              placeholder="e.g. Monthly AMC charge — {month}"
              value={values.narrationTemplate}
              disabled={disabled}
              onChange={(e) => set('narrationTemplate', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Offset line template</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Line type</label>
            <Select
              className="h-9 text-[13px]"
              value={values.lineType}
              disabled={disabled}
              onChange={(e) => set('lineType', e.target.value as TreasuryAdjustmentLineType)}
            >
              {ADJUSTMENT_LINE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GL account</label>
            <Select
              className="h-9 text-[13px]"
              value={values.accountId}
              disabled={disabled}
              onChange={(e) => set('accountId', e.target.value)}
            >
              <option value="">Select account…</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </Select>
            {fieldErrors?.accountId ? <p className="text-[11px] text-rose-600">{fieldErrors.accountId}</p> : null}
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Line description</label>
            <Input value={values.lineDescription} disabled={disabled} onChange={(e) => set('lineDescription', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GST treatment</label>
            <Select
              className="h-9 text-[13px]"
              value={values.gstTreatment}
              disabled={disabled}
              onChange={(e) => set('gstTreatment', e.target.value as GstTreatment)}
            >
              {GST_TREATMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {values.gstTreatment === 'GST_APPLICABLE' || values.gstTreatment === 'GST_NON_RECOVERABLE' ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GST rate %</label>
                <Input inputMode="decimal" value={values.gstRate} disabled={disabled} onChange={(e) => set('gstRate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GST account</label>
                <Select
                  className="h-9 text-[13px]"
                  value={values.gstAccountId}
                  disabled={disabled}
                  onChange={(e) => set('gstAccountId', e.target.value)}
                >
                  <option value="">Select account…</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} — {a.accountName}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : null}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">TDS treatment</label>
            <Select
              className="h-9 text-[13px]"
              value={values.tdsTreatment}
              disabled={disabled}
              onChange={(e) => set('tdsTreatment', e.target.value as TdsTreatment)}
            >
              {TDS_TREATMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {values.tdsTreatment === 'TDS_DEDUCTED' ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">TDS rate %</label>
                <Input inputMode="decimal" value={values.tdsRate} disabled={disabled} onChange={(e) => set('tdsRate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">TDS account</label>
                <Select
                  className="h-9 text-[13px]"
                  value={values.tdsAccountId}
                  disabled={disabled}
                  onChange={(e) => set('tdsAccountId', e.target.value)}
                >
                  <option value="">Select account…</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} — {a.accountName}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
