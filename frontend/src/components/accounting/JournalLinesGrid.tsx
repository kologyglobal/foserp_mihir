import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { AccountingDimension, LedgerAccount, VoucherLine } from '../../types/accounting'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { ErpButton } from '../erp/ErpButton'
import { FormattedCurrencyInput } from '../forms/FormattedCurrencyInput'
import { formatCurrency } from '../../utils/formatters/currency'
import { genAccountingId, sumVoucherLines } from '../../utils/accounting/ledgerEngine'
import { cn } from '../../utils/cn'

function emptyLine(lineNo: number): VoucherLine {
  return {
    id: genAccountingId('vl'),
    lineNo,
    accountId: '',
    debit: 0,
    credit: 0,
    narration: '',
    dimension1: null,
    partyType: null,
    partyId: null,
  }
}

interface JournalLinesGridProps {
  lines: VoucherLine[]
  onChange: (lines: VoucherLine[]) => void
  accounts: LedgerAccount[]
  dimensions?: AccountingDimension[]
  readOnly?: boolean
  minLines?: number
}

/** Debit/credit line editor for Payment / Receipt / Contra / Journal vouchers. Reuses erp-line-items-grid styling. */
export function JournalLinesGrid({
  lines,
  onChange,
  accounts,
  dimensions = [],
  readOnly,
  minLines = 2,
}: JournalLinesGridProps) {
  const accountOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      accounts
        .filter((a) => a.isPostable && a.isActive)
        .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, searchText: `${a.code} ${a.name}`.toLowerCase() })),
    [accounts],
  )

  const departmentValues = dimensions.find((d) => d.name === 'Department')?.values ?? []

  const { totalDebit, totalCredit } = sumVoucherLines(lines)
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100
  const balanced = Math.abs(difference) < 0.005 && totalDebit > 0

  function updateLine(id: string, patch: Partial<VoucherLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addRow() {
    onChange([...lines, emptyLine(lines.length + 1)])
  }

  function removeRow(id: string) {
    if (lines.length <= minLines) return
    onChange(lines.filter((l) => l.id !== id).map((l, idx) => ({ ...l, lineNo: idx + 1 })))
  }

  return (
    <div className="erp-line-items-grid">
      <div className="erp-line-items-grid__toolbar">
        <div className="erp-line-items-grid__toolbar-stats">
          <span><strong>{lines.length}</strong> line{lines.length === 1 ? '' : 's'}</span>
        </div>
        {!readOnly ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={addRow}>
            Add Line
          </ErpButton>
        ) : null}
      </div>

      <div className="quo-editor-price__table-wrap erp-line-items-grid__wrap">
        <table className="quo-editor-price__table erp-line-items-grid__table">
          <thead>
            <tr>
              <th className="erp-line-items-grid__sticky-sr">#</th>
              <th className="erp-line-items-grid__sticky-product">Account</th>
              <th>Narration</th>
              {departmentValues.length > 0 ? <th>Department</th> : null}
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              {!readOnly ? <th className="erp-line-items-grid__col-actions" aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id}>
                <td className="tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                <td className="erp-line-items-grid__sticky-product min-w-[220px]">
                  {readOnly ? (
                    <span>{accounts.find((a) => a.id === line.accountId)?.name ?? '—'}</span>
                  ) : (
                    <ErpSmartSelect
                      options={accountOptions}
                      value={line.accountId}
                      onChange={(v) => updateLine(line.id, { accountId: v as string })}
                      placeholder="Select account…"
                      appearance="dropdown"
                    />
                  )}
                </td>
                <td className="min-w-[160px]">
                  {readOnly ? (
                    line.narration || '—'
                  ) : (
                    <input
                      className="quo-editor-price__input"
                      value={line.narration}
                      onChange={(e) => updateLine(line.id, { narration: e.target.value })}
                      placeholder="Line narration"
                    />
                  )}
                </td>
                {departmentValues.length > 0 ? (
                  <td className="min-w-[140px]">
                    {readOnly ? (
                      departmentValues.find((d) => d.id === line.dimension1)?.name ?? '—'
                    ) : (
                      <select
                        className="quo-editor-price__input"
                        value={line.dimension1 ?? ''}
                        onChange={(e) => updateLine(line.id, { dimension1: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {departmentValues.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                ) : null}
                <td className="text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</span>
                  ) : (
                    <FormattedCurrencyInput
                      className="erp-line-items-grid__input-num"
                      value={line.debit}
                      onValueChange={(debit) => updateLine(line.id, { debit: Math.max(0, debit), credit: debit > 0 ? 0 : line.credit })}
                      aria-label="Debit"
                    />
                  )}
                </td>
                <td className="text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</span>
                  ) : (
                    <FormattedCurrencyInput
                      className="erp-line-items-grid__input-num"
                      value={line.credit}
                      onValueChange={(credit) => updateLine(line.id, { credit: Math.max(0, credit), debit: credit > 0 ? 0 : line.debit })}
                      aria-label="Credit"
                    />
                  )}
                </td>
                {!readOnly ? (
                  <td className="erp-line-items-grid__col-actions">
                    <button
                      type="button"
                      className="erp-line-items-grid__action-btn erp-line-items-grid__action-btn--danger"
                      onClick={() => removeRow(line.id)}
                      disabled={lines.length <= minLines}
                      title="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="erp-line-items-grid__totals">
        <div className="erp-line-items-grid__totals-row erp-line-items-grid__totals-row--grand">
          <span className="erp-line-items-grid__totals-item">
            Total Debit <strong>{formatCurrency(totalDebit)}</strong>
          </span>
          <span className="erp-line-items-grid__totals-item">
            Total Credit <strong>{formatCurrency(totalCredit)}</strong>
          </span>
          <span
            className={cn(
              'erp-line-items-grid__totals-item erp-line-items-grid__totals-item--total',
              balanced ? 'text-erp-success-fg' : 'text-erp-danger-fg',
            )}
          >
            {balanced ? 'Balanced' : `Difference ${formatCurrency(Math.abs(difference))}`}
          </span>
        </div>
      </div>
    </div>
  )
}
