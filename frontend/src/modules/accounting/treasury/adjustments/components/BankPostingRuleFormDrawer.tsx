import { useEffect, useState } from 'react'
import { BankCashDrawerShell } from '@/components/accounting/bankCash'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { listAccounts } from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import type { TransferAccountSnapshot } from '../../transfers/api/treasury-transfer.types'
import { ADJUSTMENT_TYPE_OPTIONS, GST_TREATMENT_OPTIONS, LINE_TYPE_OPTIONS, TDS_TREATMENT_OPTIONS } from '../utils/format'
import type { BankPostingRuleDto, CreateBankPostingRuleInput, TreasuryAdjustmentType } from '../api/treasury-adjustment.types'

export interface BankPostingRuleFormValues {
  name: string
  description: string
  treasuryAccountId: string
  isActive: boolean
  priority: string
  direction: '' | 'DEBIT' | 'CREDIT'
  keywordPatterns: string
  minAmount: string
  maxAmount: string
  adjustmentType: TreasuryAdjustmentType
  lineType: string
  lineAccountId: string
  lineDescription: string
  gstTreatment: string
  gstRate: string
  tdsTreatment: string
  tdsRate: string
}

export const EMPTY_BANK_POSTING_RULE_FORM: BankPostingRuleFormValues = {
  name: '',
  description: '',
  treasuryAccountId: '',
  isActive: true,
  priority: '100',
  direction: '',
  keywordPatterns: '',
  minAmount: '',
  maxAmount: '',
  adjustmentType: 'BANK_CHARGES',
  lineType: 'EXPENSE',
  lineAccountId: '',
  lineDescription: '',
  gstTreatment: 'GST_NOT_APPLICABLE',
  gstRate: '',
  tdsTreatment: 'TDS_NOT_APPLICABLE',
  tdsRate: '',
}

export function bankPostingRuleToFormValues(rule: BankPostingRuleDto): BankPostingRuleFormValues {
  return {
    name: rule.name,
    description: rule.description ?? '',
    treasuryAccountId: rule.treasuryAccountId ?? '',
    isActive: rule.isActive,
    priority: String(rule.priority),
    direction: rule.direction ?? '',
    keywordPatterns: rule.keywordPatterns.join(', '),
    minAmount: rule.minAmount ?? '',
    maxAmount: rule.maxAmount ?? '',
    adjustmentType: rule.adjustmentType,
    lineType: rule.lineTemplate.lineType,
    lineAccountId: rule.lineTemplate.accountId ?? '',
    lineDescription: rule.lineTemplate.description ?? '',
    gstTreatment: rule.lineTemplate.gstTreatment ?? 'GST_NOT_APPLICABLE',
    gstRate: rule.lineTemplate.gstRate ?? '',
    tdsTreatment: rule.lineTemplate.tdsTreatment ?? 'TDS_NOT_APPLICABLE',
    tdsRate: rule.lineTemplate.tdsRate ?? '',
  }
}

export function buildCreateBankPostingRulePayload(values: BankPostingRuleFormValues, legalEntityId: string): CreateBankPostingRuleInput {
  return {
    legalEntityId,
    treasuryAccountId: values.treasuryAccountId || null,
    name: values.name,
    description: values.description || null,
    isActive: values.isActive,
    priority: Number(values.priority) || 100,
    direction: values.direction || null,
    keywordPatterns: values.keywordPatterns
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    minAmount: values.minAmount || null,
    maxAmount: values.maxAmount || null,
    adjustmentType: values.adjustmentType,
    lineTemplate: {
      lineType: values.lineType as CreateBankPostingRuleInput['lineTemplate']['lineType'],
      accountId: values.lineAccountId || null,
      description: values.lineDescription || null,
      gstTreatment: values.gstTreatment as CreateBankPostingRuleInput['lineTemplate']['gstTreatment'],
      gstRate: values.gstRate || null,
      tdsTreatment: values.tdsTreatment as CreateBankPostingRuleInput['lineTemplate']['tdsTreatment'],
      tdsRate: values.tdsRate || null,
    },
  }
}

export function BankPostingRuleFormDrawer({
  open,
  onClose,
  values,
  onChange,
  onSave,
  saving,
  accounts,
  legalEntityId,
  title,
}: {
  open: boolean
  onClose: () => void
  values: BankPostingRuleFormValues
  onChange: (next: BankPostingRuleFormValues) => void
  onSave: () => void
  saving: boolean
  accounts: TransferAccountSnapshot[]
  legalEntityId: string | undefined
  title: string
}) {
  const [glAccounts, setGlAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (!legalEntityId) return
    listAccounts(legalEntityId)
      .then((res) => setGlAccounts(res.filter((a) => a.isActive && !a.isGroup)))
      .catch(() => setGlAccounts([]))
  }, [legalEntityId])

  const set = <K extends keyof BankPostingRuleFormValues>(key: K, value: BankPostingRuleFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <BankCashDrawerShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Deterministic keyword/amount matcher for statement-line classification."
      widthClassName="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </ErpButton>
          <ErpButton onClick={onSave} loading={saving}>
            Save
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Rule name</label>
            <Input value={values.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Description</label>
            <Input value={values.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Bank account (optional)</label>
            <Select className="h-9 text-[13px]" value={values.treasuryAccountId} onChange={(e) => set('treasuryAccountId', e.target.value)}>
              <option value="">Any bank account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} â€” {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Priority (lower runs first)</label>
            <Input inputMode="numeric" value={values.priority} onChange={(e) => set('priority', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Statement direction</label>
            <Select className="h-9 text-[13px]" value={values.direction} onChange={(e) => set('direction', e.target.value as 'DEBIT' | 'CREDIT' | '')}>
              <option value="">Either</option>
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Adjustment type</label>
            <Select className="h-9 text-[13px]" value={values.adjustmentType} onChange={(e) => set('adjustmentType', e.target.value as TreasuryAdjustmentType)}>
              {ADJUSTMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Keyword patterns (comma-separated)</label>
            <Input placeholder="e.g. NEFT CHG, BANK CHARGE" value={values.keywordPatterns} onChange={(e) => set('keywordPatterns', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Min amount (optional)</label>
            <Input inputMode="decimal" value={values.minAmount} onChange={(e) => set('minAmount', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Max amount (optional)</label>
            <Input inputMode="decimal" value={values.maxAmount} onChange={(e) => set('maxAmount', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              id="rule-is-active"
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-erp-border"
            />
            <label htmlFor="rule-is-active" className="text-[12px] font-medium text-erp-text">
              Active
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-erp-border p-3">
          <h4 className="mb-2 text-[12px] font-semibold text-erp-text">Line template</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Line type</label>
              <Select className="h-9 text-[13px]" value={values.lineType} onChange={(e) => set('lineType', e.target.value)}>
                {LINE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GL account</label>
              <Select className="h-9 text-[13px]" value={values.lineAccountId} onChange={(e) => set('lineAccountId', e.target.value)}>
                <option value="">Select accountâ€¦</option>
                {glAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} â€” {a.accountName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Description</label>
              <Input value={values.lineDescription} onChange={(e) => set('lineDescription', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GST treatment</label>
              <Select className="h-9 text-[13px]" value={values.gstTreatment} onChange={(e) => set('gstTreatment', e.target.value)}>
                {GST_TREATMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {values.gstTreatment !== 'GST_NOT_APPLICABLE' ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">GST rate %</label>
                <Input inputMode="decimal" value={values.gstRate} onChange={(e) => set('gstRate', e.target.value)} />
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">TDS treatment</label>
              <Select className="h-9 text-[13px]" value={values.tdsTreatment} onChange={(e) => set('tdsTreatment', e.target.value)}>
                {TDS_TREATMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {values.tdsTreatment === 'TDS_DEDUCTED' ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">TDS rate %</label>
                <Input inputMode="decimal" value={values.tdsRate} onChange={(e) => set('tdsRate', e.target.value)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </BankCashDrawerShell>
  )
}
