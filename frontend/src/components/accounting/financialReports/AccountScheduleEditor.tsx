import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import type {
  AccountScheduleColumn,
  AccountScheduleColumnType,
  AccountScheduleDefinition,
  AccountScheduleRow,
  AccountScheduleTotalingType,
} from '@/types/financialReports'
import { cn } from '@/utils/cn'

const TOTALING_TYPES: AccountScheduleTotalingType[] = [
  'PostingAccounts',
  'Total',
  'Formula',
  'Underline',
  'Blank',
]

const COLUMN_TYPES: AccountScheduleColumnType[] = [
  'CurrentMonth',
  'PreviousMonth',
  'CurrentYear',
  'PreviousYear',
  'Budget',
  'Variance',
  'VariancePct',
]

function emptyRow(index: number): AccountScheduleRow {
  return {
    rowCode: String((index + 1) * 10),
    description: '',
    totalingType: 'PostingAccounts',
    accountRange: '',
    formula: '',
    show: true,
    indent: 0,
    bold: false,
    underline: false,
    signReversal: false,
  }
}

function emptyColumn(index: number): AccountScheduleColumn {
  return {
    id: `col-${index + 1}`,
    label: `Column ${index + 1}`,
    columnType: 'CurrentYear',
  }
}

export function AccountScheduleEditor({
  definition,
  readOnly = false,
  onSave,
  className,
}: {
  definition: AccountScheduleDefinition
  readOnly?: boolean
  onSave?: (definition: AccountScheduleDefinition) => void
  className?: string
}) {
  const [draft, setDraft] = useState<AccountScheduleDefinition>(definition)

  useEffect(() => {
    setDraft(definition)
  }, [definition])

  function patchRows(rows: AccountScheduleRow[]) {
    setDraft((d) => ({ ...d, rows }))
  }

  function patchColumns(columns: AccountScheduleColumn[]) {
    setDraft((d) => ({ ...d, columns }))
  }

  function updateRow(index: number, partial: Partial<AccountScheduleRow>) {
    patchRows(draft.rows.map((r, i) => (i === index ? { ...r, ...partial } : r)))
  }

  function updateColumn(index: number, partial: Partial<AccountScheduleColumn>) {
    patchColumns(draft.columns.map((c, i) => (i === index ? { ...c, ...partial } : c)))
  }

  function addRow() {
    patchRows([...draft.rows, emptyRow(draft.rows.length)])
  }

  function removeRow(index: number) {
    patchRows(draft.rows.filter((_, i) => i !== index))
  }

  function addColumn() {
    patchColumns([...draft.columns, emptyColumn(draft.columns.length)])
  }

  function removeColumn(index: number) {
    patchColumns(draft.columns.filter((_, i) => i !== index))
  }

  function handleSave() {
    onSave?.(draft)
  }

  const inputClass = 'erp-input h-7 w-full min-w-0 px-1.5 text-[11px]'
  const checkClass = 'rounded border-erp-border'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Columns</span>
        {draft.columns.map((col, i) => (
          <span
            key={col.id}
            className="inline-flex items-center gap-1 rounded-full border border-erp-border bg-erp-surface px-2 py-0.5 text-[10px] font-semibold text-erp-text"
          >
            {!readOnly ? (
              <input
                type="text"
                className="w-16 border-0 bg-transparent p-0 text-[10px] focus:outline-none"
                value={col.label}
                onChange={(e) => updateColumn(i, { label: e.target.value })}
              />
            ) : (
              col.label
            )}
            {!readOnly ? (
              <select
                className="border-0 bg-transparent p-0 text-[9px] text-erp-muted focus:outline-none"
                value={col.columnType}
                onChange={(e) => updateColumn(i, { columnType: e.target.value as AccountScheduleColumnType })}
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-erp-muted">({col.columnType})</span>
            )}
            {!readOnly && draft.columns.length > 1 ? (
              <button
                type="button"
                className="text-erp-muted hover:text-rose-600"
                onClick={() => removeColumn(i)}
                aria-label={`Remove column ${col.label}`}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {!readOnly ? (
          <button
            type="button"
            className="erp-btn erp-btn-ghost inline-flex h-6 items-center gap-1 px-2 text-[10px] font-semibold"
            onClick={addColumn}
          >
            <Plus className="h-3 w-3" />
            Column
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
        <table className="w-full min-w-[64rem] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-erp-border bg-erp-surface">
              <th className="px-1.5 py-1.5 text-left font-semibold text-erp-muted">Row</th>
              <th className="min-w-[10rem] px-1.5 py-1.5 text-left font-semibold text-erp-muted">Description</th>
              <th className="min-w-[7rem] px-1.5 py-1.5 text-left font-semibold text-erp-muted">Totaling</th>
              <th className="min-w-[7rem] px-1.5 py-1.5 text-left font-semibold text-erp-muted">Account range</th>
              <th className="min-w-[6rem] px-1.5 py-1.5 text-left font-semibold text-erp-muted">Formula</th>
              <th className="px-1.5 py-1.5 text-center font-semibold text-erp-muted">Show</th>
              <th className="w-12 px-1.5 py-1.5 text-center font-semibold text-erp-muted">Ind</th>
              <th className="px-1.5 py-1.5 text-center font-semibold text-erp-muted">B</th>
              <th className="px-1.5 py-1.5 text-center font-semibold text-erp-muted">U</th>
              <th className="px-1.5 py-1.5 text-center font-semibold text-erp-muted">Rev</th>
              {!readOnly ? <th className="w-8 px-1.5 py-1.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, i) => (
              <tr key={`${row.rowCode}-${i}`} className="border-b border-erp-border/50 hover:bg-erp-surface-alt/20">
                <td className="px-1.5 py-1">
                  {readOnly ? (
                    <span className="font-mono">{row.rowCode}</span>
                  ) : (
                    <input
                      type="text"
                      className={cn(inputClass, 'w-12 font-mono')}
                      value={row.rowCode}
                      onChange={(e) => updateRow(i, { rowCode: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-1.5 py-1">
                  {readOnly ? (
                    <span style={{ paddingLeft: `${row.indent * 8}px` }}>{row.description}</span>
                  ) : (
                    <input
                      type="text"
                      className={inputClass}
                      style={{ paddingLeft: `${4 + row.indent * 8}px` }}
                      value={row.description}
                      onChange={(e) => updateRow(i, { description: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-1.5 py-1">
                  {readOnly ? (
                    row.totalingType
                  ) : (
                    <select
                      className={inputClass}
                      value={row.totalingType}
                      onChange={(e) => updateRow(i, { totalingType: e.target.value as AccountScheduleTotalingType })}
                    >
                      {TOTALING_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-1.5 py-1">
                  {readOnly ? (
                    <span className="font-mono text-[10px]">{row.accountRange || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      className={cn(inputClass, 'font-mono')}
                      placeholder="1110..1199"
                      value={row.accountRange}
                      onChange={(e) => updateRow(i, { accountRange: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-1.5 py-1">
                  {readOnly ? (
                    <span className="font-mono text-[10px]">{row.formula || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      className={cn(inputClass, 'font-mono')}
                      placeholder="10+20"
                      value={row.formula}
                      onChange={(e) => updateRow(i, { formula: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    className={checkClass}
                    checked={row.show}
                    disabled={readOnly}
                    onChange={(e) => updateRow(i, { show: e.target.checked })}
                  />
                </td>
                <td className="px-1.5 py-1 text-center">
                  {readOnly ? (
                    row.indent
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={6}
                      className={cn(inputClass, 'w-10 text-center')}
                      value={row.indent}
                      onChange={(e) => updateRow(i, { indent: Number(e.target.value) || 0 })}
                    />
                  )}
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    className={checkClass}
                    checked={row.bold}
                    disabled={readOnly}
                    onChange={(e) => updateRow(i, { bold: e.target.checked })}
                  />
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    className={checkClass}
                    checked={row.underline}
                    disabled={readOnly}
                    onChange={(e) => updateRow(i, { underline: e.target.checked })}
                  />
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    className={checkClass}
                    checked={row.signReversal}
                    disabled={readOnly}
                    onChange={(e) => updateRow(i, { signReversal: e.target.checked })}
                  />
                </td>
                {!readOnly ? (
                  <td className="px-1.5 py-1 text-center">
                    <button
                      type="button"
                      className="text-erp-muted hover:text-rose-600"
                      onClick={() => removeRow(i)}
                      aria-label={`Remove row ${row.rowCode}`}
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

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="erp-btn erp-btn-ghost inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
          {onSave ? (
            <button
              type="button"
              className="erp-btn erp-btn-primary inline-flex h-8 items-center gap-1.5 px-4 text-[12px] font-semibold"
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5" />
              Save schedule
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
