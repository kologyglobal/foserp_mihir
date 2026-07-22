import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Input, Select } from '@/components/forms/Inputs'
import { listAccounts, listBranches } from '@/services/bridges/financeApiBridge'
import type { Account, Branch } from '@/types/financeSetup'
import type {
  ChequeAccountSnapshot,
  CreateChequeInput,
  TreasuryChequeAccountingMode,
  TreasuryChequeDirection,
} from '../api/treasury-cheque.types'
import { CHEQUE_DIRECTION_OPTIONS } from '../utils/treasuryChequeUi'
import { todayIsoDate } from '../utils/format'

export interface ChequeFormValues {
  direction: TreasuryChequeDirection
  treasuryAccountId: string
  chequeNumber: string
  chequeDate: string
  payeeOrDrawerName: string
  amount: string
  isPdc: boolean
  pdcMaturityDate: string
  accountingMode: TreasuryChequeAccountingMode
  counterpartGlAccountId: string
  bankName: string
  branchName: string
  ifsc: string
  currencyCode: string
  narration: string
  internalNote: string
  branchId: string
}

export const EMPTY_CHEQUE_FORM: ChequeFormValues = {
  direction: 'ISSUED',
  treasuryAccountId: '',
  chequeNumber: '',
  chequeDate: todayIsoDate(),
  payeeOrDrawerName: '',
  amount: '',
  isPdc: false,
  pdcMaturityDate: '',
  accountingMode: 'POST_ON_LIFECYCLE',
  counterpartGlAccountId: '',
  bankName: '',
  branchName: '',
  ifsc: '',
  currencyCode: 'INR',
  narration: '',
  internalNote: '',
  branchId: '',
}

export function buildCreateChequePayload(values: ChequeFormValues, legalEntityId: string): CreateChequeInput {
  return {
    legalEntityId,
    branchId: values.branchId || null,
    treasuryAccountId: values.treasuryAccountId,
    direction: values.direction,
    accountingMode: values.accountingMode,
    chequeNumber: values.chequeNumber,
    chequeDate: values.chequeDate,
    bankName: values.bankName || null,
    branchName: values.branchName || null,
    ifsc: values.ifsc || null,
    payeeOrDrawerName: values.payeeOrDrawerName,
    currencyCode: values.currencyCode || 'INR',
    amount: values.amount,
    isPdc: values.isPdc,
    pdcMaturityDate: values.isPdc ? values.pdcMaturityDate || null : null,
    counterpartGlAccountId: values.counterpartGlAccountId || null,
    narration: values.narration || null,
    internalNote: values.internalNote || null,
  }
}

export function ChequeForm({
  values,
  onChange,
  accounts,
  accountsLoading,
  legalEntityId,
  disabled,
  fieldErrors,
}: {
  values: ChequeFormValues
  onChange: (next: ChequeFormValues) => void
  accounts: ChequeAccountSnapshot[]
  accountsLoading: boolean
  legalEntityId: string | undefined
  disabled?: boolean
  fieldErrors?: Partial<Record<keyof ChequeFormValues, string>>
}) {
  const [showMore, setShowMore] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [glAccounts, setGlAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (!legalEntityId) return
    listBranches(legalEntityId)
      .then(setBranches)
      .catch(() => setBranches([]))
    listAccounts(legalEntityId)
      .then((res) => setGlAccounts(res.filter((a) => a.isActive && !a.isGroup)))
      .catch(() => setGlAccounts([]))
  }, [legalEntityId])

  const set = <K extends keyof ChequeFormValues>(key: K, value: ChequeFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  const errorText = (key: keyof ChequeFormValues) => fieldErrors?.[key]

  const branchOptions = useMemo(() => branches.filter((b) => b.legalEntityId === legalEntityId), [branches, legalEntityId])

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Cheque details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Direction</label>
            <Select
              className="h-9 text-[13px]"
              value={values.direction}
              disabled={disabled}
              onChange={(e) => set('direction', e.target.value as TreasuryChequeDirection)}
            >
              {CHEQUE_DIRECTION_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Bank account</label>
            <Select
              className="h-9 text-[13px]"
              value={values.treasuryAccountId}
              disabled={disabled || accountsLoading}
              aria-label="Bank account"
              onChange={(e) => set('treasuryAccountId', e.target.value)}
            >
              <option value="">Select bank account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
            {errorText('treasuryAccountId') ? <p className="text-[11px] text-rose-600">{errorText('treasuryAccountId')}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Cheque number</label>
            <Input
              placeholder="e.g. 000123"
              value={values.chequeNumber}
              disabled={disabled}
              error={Boolean(errorText('chequeNumber'))}
              onChange={(e) => set('chequeNumber', e.target.value)}
            />
            {errorText('chequeNumber') ? <p className="text-[11px] text-rose-600">{errorText('chequeNumber')}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Cheque date</label>
            <Input
              type="date"
              value={values.chequeDate}
              disabled={disabled}
              error={Boolean(errorText('chequeDate'))}
              onChange={(e) => set('chequeDate', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              {values.direction === 'ISSUED' ? 'Payee name' : 'Drawer name'}
            </label>
            <Input
              placeholder={values.direction === 'ISSUED' ? 'Who is this cheque payable to?' : 'Who issued this cheque?'}
              value={values.payeeOrDrawerName}
              disabled={disabled}
              error={Boolean(errorText('payeeOrDrawerName'))}
              onChange={(e) => set('payeeOrDrawerName', e.target.value)}
            />
            {errorText('payeeOrDrawerName') ? <p className="text-[11px] text-rose-600">{errorText('payeeOrDrawerName')}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Amount</label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={values.amount}
              disabled={disabled}
              error={Boolean(errorText('amount'))}
              onChange={(e) => set('amount', e.target.value)}
            />
            {errorText('amount') ? <p className="text-[11px] text-rose-600">{errorText('amount')}</p> : null}
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              id="cheque-is-pdc"
              type="checkbox"
              checked={values.isPdc}
              disabled={disabled}
              onChange={(e) => set('isPdc', e.target.checked)}
              className="h-4 w-4 rounded border-erp-border"
            />
            <label htmlFor="cheque-is-pdc" className="text-[12px] font-medium text-erp-text">
              Post-dated cheque (PDC)
            </label>
          </div>
          {values.isPdc ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">PDC maturity date</label>
              <Input
                type="date"
                value={values.pdcMaturityDate}
                disabled={disabled}
                error={Boolean(errorText('pdcMaturityDate'))}
                onChange={(e) => set('pdcMaturityDate', e.target.value)}
              />
              {errorText('pdcMaturityDate') ? <p className="text-[11px] text-rose-600">{errorText('pdcMaturityDate')}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Narration</label>
            <textarea
              className="erp-input text-[13px]"
              rows={2}
              placeholder="Purpose / description of this cheque"
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
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Accounting mode</label>
              <Select
                className="h-9 text-[13px]"
                value={values.accountingMode}
                disabled={disabled}
                onChange={(e) => set('accountingMode', e.target.value as TreasuryChequeAccountingMode)}
              >
                <option value="POST_ON_LIFECYCLE">Post on lifecycle (issue/deposit posts GL)</option>
                <option value="TRACK_ONLY">Track only (no GL posting)</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Counterpart GL account</label>
              <Select
                className="h-9 text-[13px]"
                value={values.counterpartGlAccountId}
                disabled={disabled}
                onChange={(e) => set('counterpartGlAccountId', e.target.value)}
              >
                <option value="">Auto (use default mapping)</option>
                {glAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Bank name</label>
              <Input
                value={values.bankName}
                disabled={disabled}
                onChange={(e) => set('bankName', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Branch name</label>
              <Input
                value={values.branchName}
                disabled={disabled}
                onChange={(e) => set('branchName', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">IFSC</label>
              <Input value={values.ifsc} disabled={disabled} onChange={(e) => set('ifsc', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Currency</label>
              <Input value={values.currencyCode} disabled={disabled} onChange={(e) => set('currencyCode', e.target.value.toUpperCase())} />
            </div>
            {branchOptions.length > 0 ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Branch</label>
                <Select
                  className="h-9 text-[13px]"
                  value={values.branchId}
                  disabled={disabled}
                  onChange={(e) => set('branchId', e.target.value)}
                >
                  <option value="">Not specified</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
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
        ) : null}
      </section>
    </div>
  )
}
