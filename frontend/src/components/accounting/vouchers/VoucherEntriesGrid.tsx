import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Input, Select } from '@/components/forms/Inputs'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { formatCurrency, parseCurrencyInput } from '@/utils/formatters/currency'
import type { AccountingVoucherLine, VoucherCostCentreOption, VoucherLineGst, VoucherLineTds } from '@/types/vouchers'
import { emptyVoucherLine, sumVoucherDebitCredit } from '@/types/vouchers'
import { VoucherAccountPickerModal } from './VoucherPickers'

type LineDraft = AccountingVoucherLine

export function VoucherEntriesGrid({
  lines,
  onChange,
  readOnly,
  costCentres,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  readOnly?: boolean
  costCentres: VoucherCostCentreOption[]
}) {
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [detailIdx, setDetailIdx] = useState<number | null>(null)
  const [balanceOpen, setBalanceOpen] = useState(false)
  const sums = sumVoucherDebitCredit(lines)

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const addLine = () => {
    const blank = emptyVoucherLine()
    onChange([
      ...lines,
      {
        ...blank,
        id: `tmp-${Date.now()}-${lines.length}`,
        lineNo: lines.length + 1,
      },
    ])
  }

  const removeLine = (idx: number) => {
    onChange(lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, lineNo: i + 1 })))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] text-erp-muted">
          Totals · Dr <span className="font-semibold tabular-nums text-erp-text">{formatCurrency(sums.totalDebit)}</span>
          {' · '}
          Cr <span className="font-semibold tabular-nums text-erp-text">{formatCurrency(sums.totalCredit)}</span>
          {' · '}
          Diff{' '}
          <span className={`font-semibold tabular-nums ${sums.isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>
            {formatCurrency(sums.difference)}
          </span>
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-8 px-2 text-[12px]" onClick={() => setBalanceOpen(true)}>
              Balance entries
            </button>
            <button type="button" className="erp-btn erp-btn-primary h-8 px-2 text-[12px]" onClick={addLine}>
              <Plus className="mr-1 inline h-3.5 w-3.5" />
              Add line
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-erp-border">
        <table className="erp-table w-full min-w-[880px] text-[13px]">
          <thead>
            <tr className="border-b bg-erp-surface-alt/60 text-left text-[11px] uppercase text-erp-muted">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2 text-right">Debit</th>
              <th className="px-2 py-2 text-right">Credit</th>
              <th className="px-2 py-2">Narration</th>
              <th className="px-2 py-2">Cost centre</th>
              <th className="px-2 py-2">More</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id} className="border-b border-erp-border/70">
                <td className="px-2 py-1.5 tabular-nums text-erp-muted">{line.lineNo}</td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span>
                      <span className="font-semibold tabular-nums">{line.accountCode}</span> {line.accountName}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-left text-sky-800 hover:underline"
                      onClick={() => setPickerFor(idx)}
                    >
                      {line.accountId ? (
                        <>
                          <span className="font-semibold tabular-nums">{line.accountCode}</span> {line.accountName}
                        </>
                      ) : (
                        'Select account…'
                      )}
                    </button>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{line.debit ? formatCurrency(line.debit) : '—'}</span>
                  ) : (
                    <Input
                      className="text-right"
                      inputMode="decimal"
                      value={line.debit ? String(line.debit) : ''}
                      onChange={(e) => {
                        const debit = parseCurrencyInput(e.target.value)
                        updateLine(idx, { debit, credit: debit > 0 ? 0 : line.credit })
                      }}
                      aria-label={`Debit line ${line.lineNo}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{line.credit ? formatCurrency(line.credit) : '—'}</span>
                  ) : (
                    <Input
                      className="text-right"
                      inputMode="decimal"
                      value={line.credit ? String(line.credit) : ''}
                      onChange={(e) => {
                        const credit = parseCurrencyInput(e.target.value)
                        updateLine(idx, { credit, debit: credit > 0 ? 0 : line.debit })
                      }}
                      aria-label={`Credit line ${line.lineNo}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    line.narration || '—'
                  ) : (
                    <Input
                      value={line.narration}
                      onChange={(e) => updateLine(idx, { narration: e.target.value })}
                      aria-label={`Narration line ${line.lineNo}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    line.costCentreName || '—'
                  ) : (
                    <Select
                      value={line.costCentreId ?? ''}
                      onChange={(e) => {
                        const cc = costCentres.find((c) => c.id === e.target.value)
                        updateLine(idx, {
                          costCentreId: cc?.id ?? null,
                          costCentreName: cc?.name ?? null,
                        })
                      }}
                    >
                      <option value="">—</option>
                      {costCentres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                      title="Line details"
                      aria-label={`Line details ${line.lineNo}`}
                      onClick={() => setDetailIdx(idx)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-red-700"
                        title="Remove"
                        aria-label={`Remove line ${line.lineNo}`}
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <VoucherAccountPickerModal
        open={pickerFor != null}
        onClose={() => setPickerFor(null)}
        onSelect={(a) => {
          if (pickerFor == null) return
          updateLine(pickerFor, {
            accountId: a.id,
            accountCode: a.code,
            accountName: a.name,
          })
        }}
      />

      <VoucherLineDetailsDrawer
        open={detailIdx != null}
        line={detailIdx != null ? lines[detailIdx] : null}
        readOnly={readOnly}
        onClose={() => setDetailIdx(null)}
        onSave={(patch) => {
          if (detailIdx == null) return
          updateLine(detailIdx, patch)
          setDetailIdx(null)
        }}
      />

      <VoucherBalanceEntriesModal
        open={balanceOpen}
        difference={sums.difference}
        onClose={() => setBalanceOpen(false)}
        onApply={(accountId, accountCode, accountName) => {
          const diff = sums.difference
          if (Math.abs(diff) < 0.005) {
            setBalanceOpen(false)
            return
          }
          const blank = emptyVoucherLine()
          const balancing: LineDraft = {
            ...blank,
            id: `tmp-bal-${Date.now()}`,
            lineNo: lines.length + 1,
            accountId,
            accountCode,
            accountName,
            debit: diff < 0 ? Math.abs(diff) : 0,
            credit: diff > 0 ? Math.abs(diff) : 0,
            narration: 'Balancing entry',
          }
          onChange([...lines, balancing])
          setBalanceOpen(false)
        }}
      />
    </div>
  )
}

function VoucherLineDetailsDrawer({
  open,
  line,
  readOnly,
  onClose,
  onSave,
}: {
  open: boolean
  line: LineDraft | null
  readOnly?: boolean
  onClose: () => void
  onSave: (patch: Partial<LineDraft>) => void
}) {
  const [gst, setGst] = useState<VoucherLineGst>({ enabled: false, treatment: 'none' })
  const [tds, setTds] = useState<VoucherLineTds>({ enabled: false })
  const [partyName, setPartyName] = useState('')
  const [dimension1, setDimension1] = useState('')

  useEffect(() => {
    if (!open || !line) return
    setGst(line.gst ?? { enabled: false, treatment: 'none' })
    setTds(line.tds ?? { enabled: false })
    setPartyName(line.partyName ?? '')
    setDimension1(line.dimension1 ?? '')
  }, [open, line])

  return (
    <AccountDrawerShell
      open={open && !!line}
      onClose={onClose}
      title="Line details"
      subtitle={line ? `Line ${line.lineNo} · ${line.accountCode || 'No account'}` : undefined}
      footer={
        readOnly ? (
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose}>
            Close
          </button>
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              onClick={() =>
                onSave({
                  gst,
                  tds,
                  partyName: partyName || null,
                  dimension1: dimension1 || null,
                })
              }
            >
              Apply
            </button>
          </div>
        )
      }
    >
      {line ? (
        <div className="space-y-4">
          <label className="block text-[12px] font-medium">
            Party name (optional)
            <Input className="mt-1" disabled={readOnly} value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </label>
          <label className="block text-[12px] font-medium">
            Dimension 1
            <Input className="mt-1" disabled={readOnly} value={dimension1} onChange={(e) => setDimension1(e.target.value)} />
          </label>

          <fieldset className="rounded border border-erp-border p-3">
            <legend className="px-1 text-[12px] font-semibold">GST</legend>
            <label className="mb-2 flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={gst.enabled}
                onChange={(e) => setGst({ ...gst, enabled: e.target.checked })}
              />
              GST relevant
            </label>
            {gst.enabled ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12px]">
                  HSN / SAC
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    value={gst.hsnSac ?? ''}
                    onChange={(e) => setGst({ ...gst, hsnSac: e.target.value })}
                  />
                </label>
                <label className="text-[12px]">
                  GST %
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    inputMode="decimal"
                    value={gst.gstPercent != null ? String(gst.gstPercent) : ''}
                    onChange={(e) => setGst({ ...gst, gstPercent: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-[12px]">
                  CGST
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    inputMode="decimal"
                    value={gst.cgst != null ? String(gst.cgst) : ''}
                    onChange={(e) => setGst({ ...gst, cgst: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-[12px]">
                  SGST
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    inputMode="decimal"
                    value={gst.sgst != null ? String(gst.sgst) : ''}
                    onChange={(e) => setGst({ ...gst, sgst: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
            ) : (
              <p className="text-[11px] text-erp-muted">Enable to capture GST metadata (demo — not posted).</p>
            )}
          </fieldset>

          <fieldset className="rounded border border-erp-border p-3">
            <legend className="px-1 text-[12px] font-semibold">TDS</legend>
            <label className="mb-2 flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={tds.enabled}
                onChange={(e) => setTds({ ...tds, enabled: e.target.checked })}
              />
              TDS applicable
            </label>
            {tds.enabled ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12px]">
                  Section
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    value={tds.section ?? ''}
                    onChange={(e) => setTds({ ...tds, section: e.target.value })}
                  />
                </label>
                <label className="text-[12px]">
                  Rate %
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    inputMode="decimal"
                    value={tds.ratePercent != null ? String(tds.ratePercent) : ''}
                    onChange={(e) => setTds({ ...tds, ratePercent: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-[12px]">
                  TDS amount
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    inputMode="decimal"
                    value={tds.tdsAmount != null ? String(tds.tdsAmount) : ''}
                    onChange={(e) => setTds({ ...tds, tdsAmount: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
            ) : (
              <p className="text-[11px] text-erp-muted">Enable for TDS preview fields (demo — not deducted).</p>
            )}
          </fieldset>
        </div>
      ) : null}
    </AccountDrawerShell>
  )
}

function VoucherBalanceEntriesModal({
  open,
  difference,
  onClose,
  onApply,
}: {
  open: boolean
  difference: number
  onClose: () => void
  onApply: (accountId: string, accountCode: string, accountName: string) => void
}) {
  const [picker, setPicker] = useState(false)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-lg border border-erp-border bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Balance entries</h2>
            <p className="text-[12px] text-erp-muted">
              Difference {formatCurrency(difference)}. Pick an account to add a balancing line.
            </p>
          </div>
          <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="erp-btn erp-btn-primary h-9 w-full text-[13px]" onClick={() => setPicker(true)}>
          Choose balancing account
        </button>
        <VoucherAccountPickerModal
          open={picker}
          onClose={() => setPicker(false)}
          onSelect={(a) => onApply(a.id, a.code, a.name)}
        />
      </div>
    </div>,
    document.body,
  )
}
