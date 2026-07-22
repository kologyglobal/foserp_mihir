import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Input, Select } from '@/components/forms/Inputs'
import { listBranches } from '@/services/bridges/financeApiBridge'
import type { Branch } from '@/types/financeSetup'
import type { CreateTransferInput, TransferAccountSnapshot, TreasuryTransferPostingMode, TreasuryTransferPurpose } from '../api/treasury-transfer.types'
import { TRANSFER_PURPOSE_OPTIONS } from '../utils/treasuryTransferUi'
import { todayIsoDate } from '../utils/format'
import { TreasuryAccountSelector } from './TreasuryAccountSelector'

export interface TransferFormValues {
  sourceTreasuryAccountId: string
  destinationTreasuryAccountId: string
  transferAmount: string
  transferDate: string
  externalReference: string
  narration: string
  transferPurpose: TreasuryTransferPurpose
  postingMode: TreasuryTransferPostingMode | ''
  sourcePostingDate: string
  expectedReceiptDate: string
  sourceBranchId: string
  destinationBranchId: string
  internalNote: string
}

export const EMPTY_TRANSFER_FORM: TransferFormValues = {
  sourceTreasuryAccountId: '',
  destinationTreasuryAccountId: '',
  transferAmount: '',
  transferDate: todayIsoDate(),
  externalReference: '',
  narration: '',
  transferPurpose: 'FUND_MOVEMENT',
  postingMode: '',
  sourcePostingDate: todayIsoDate(),
  expectedReceiptDate: '',
  sourceBranchId: '',
  destinationBranchId: '',
  internalNote: '',
}

export function buildCreateTransferPayload(values: TransferFormValues, legalEntityId: string): CreateTransferInput {
  return {
    legalEntityId,
    sourceTreasuryAccountId: values.sourceTreasuryAccountId,
    destinationTreasuryAccountId: values.destinationTreasuryAccountId,
    transferPurpose: values.transferPurpose,
    transferDate: values.transferDate,
    sourcePostingDate: values.sourcePostingDate || values.transferDate,
    expectedReceiptDate: values.expectedReceiptDate || null,
    postingMode: values.postingMode || undefined,
    transferAmount: values.transferAmount,
    externalReference: values.externalReference || null,
    narration: values.narration || null,
    internalNote: values.internalNote || null,
    sourceBranchId: values.sourceBranchId || null,
    destinationBranchId: values.destinationBranchId || null,
  }
}

export function TransferForm({
  values,
  onChange,
  accounts,
  accountsLoading,
  legalEntityId,
  disabled,
  fieldErrors,
}: {
  values: TransferFormValues
  onChange: (next: TransferFormValues) => void
  accounts: TransferAccountSnapshot[]
  accountsLoading: boolean
  legalEntityId: string | undefined
  disabled?: boolean
  fieldErrors?: Partial<Record<keyof TransferFormValues, string>>
}) {
  const [showMore, setShowMore] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    if (!legalEntityId) return
    listBranches(legalEntityId)
      .then(setBranches)
      .catch(() => setBranches([]))
  }, [legalEntityId])

  const set = <K extends keyof TransferFormValues>(key: K, value: TransferFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  const errorText = (key: keyof TransferFormValues) => fieldErrors?.[key]

  const branchOptions = useMemo(() => branches.filter((b) => b.legalEntityId === legalEntityId), [branches, legalEntityId])

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Transfer details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TreasuryAccountSelector
            label="From account"
            accounts={accounts}
            value={values.sourceTreasuryAccountId}
            excludeId={values.destinationTreasuryAccountId || undefined}
            disabled={disabled || accountsLoading}
            onChange={(id) => set('sourceTreasuryAccountId', id)}
          />
          <TreasuryAccountSelector
            label="To account"
            accounts={accounts}
            value={values.destinationTreasuryAccountId}
            excludeId={values.sourceTreasuryAccountId || undefined}
            disabled={disabled || accountsLoading}
            onChange={(id) => set('destinationTreasuryAccountId', id)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Amount</label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={values.transferAmount}
              disabled={disabled}
              error={Boolean(errorText('transferAmount'))}
              onChange={(e) => set('transferAmount', e.target.value)}
            />
            {errorText('transferAmount') ? <p className="text-[11px] text-rose-600">{errorText('transferAmount')}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Transfer date</label>
            <Input
              type="date"
              value={values.transferDate}
              disabled={disabled}
              error={Boolean(errorText('transferDate'))}
              onChange={(e) => set('transferDate', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Reference</label>
            <Input
              placeholder="External reference / UTR"
              value={values.externalReference}
              disabled={disabled}
              onChange={(e) => set('externalReference', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Narration</label>
            <textarea
              className="erp-input text-[13px]"
              rows={2}
              placeholder="Purpose / description of this transfer"
              value={values.narration}
              disabled={disabled}
              onChange={(e) => set('narration', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowMore((v) => !v)}
        >
          <h3 className="text-[13px] font-semibold text-erp-text">More details</h3>
          {showMore ? <ChevronDown className="h-4 w-4 text-erp-muted" /> : <ChevronRight className="h-4 w-4 text-erp-muted" />}
        </button>

        {showMore ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Purpose</label>
              <Select
                className="h-9 text-[13px]"
                value={values.transferPurpose}
                disabled={disabled}
                onChange={(e) => set('transferPurpose', e.target.value as TreasuryTransferPurpose)}
              >
                {TRANSFER_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Posting mode</label>
              <Select
                className="h-9 text-[13px]"
                value={values.postingMode}
                disabled={disabled}
                onChange={(e) => set('postingMode', e.target.value as TreasuryTransferPostingMode | '')}
              >
                <option value="">Auto (use recommendation)</option>
                <option value="DIRECT">Direct</option>
                <option value="IN_TRANSIT">In Transit (clearing)</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Source posting date</label>
              <Input
                type="date"
                value={values.sourcePostingDate}
                disabled={disabled}
                onChange={(e) => set('sourcePostingDate', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Expected receipt date</label>
              <Input
                type="date"
                value={values.expectedReceiptDate}
                disabled={disabled}
                onChange={(e) => set('expectedReceiptDate', e.target.value)}
              />
            </div>
            {branchOptions.length > 0 ? (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Source branch</label>
                  <Select
                    className="h-9 text-[13px]"
                    value={values.sourceBranchId}
                    disabled={disabled}
                    onChange={(e) => set('sourceBranchId', e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Destination branch</label>
                  <Select
                    className="h-9 text-[13px]"
                    value={values.destinationBranchId}
                    disabled={disabled}
                    onChange={(e) => set('destinationBranchId', e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : null}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Internal note</label>
              <textarea
                className="erp-input text-[13px]"
                rows={2}
                placeholder="Internal note (not shown on statements)"
                value={values.internalNote}
                disabled={disabled}
                onChange={(e) => set('internalNote', e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
