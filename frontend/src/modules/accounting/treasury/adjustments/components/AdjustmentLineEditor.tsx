import { Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import type { Account } from '@/types/financeSetup'
import { GST_TREATMENT_OPTIONS, LINE_TYPE_OPTIONS, TDS_TREATMENT_OPTIONS } from '../utils/format'
import type { AdjustmentLineInput } from '../api/treasury-adjustment.types'

export function emptyAdjustmentLine(): AdjustmentLineInput {
  return {
    lineType: 'EXPENSE',
    accountId: null,
    description: '',
    amount: '',
    gstTreatment: 'GST_NOT_APPLICABLE',
    gstRate: null,
    tdsTreatment: 'TDS_NOT_APPLICABLE',
    tdsRate: null,
    narration: null,
  }
}

export function AdjustmentLineEditor({
  lines,
  onChange,
  glAccounts,
  disabled,
}: {
  lines: AdjustmentLineInput[]
  onChange: (lines: AdjustmentLineInput[]) => void
  glAccounts: Account[]
  disabled?: boolean
}) {
  const updateLine = (index: number, patch: Partial<AdjustmentLineInput>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const addLine = () => {
    onChange([...lines, emptyAdjustmentLine()])
  }

  return (
    <div className="rounded-lg border border-erp-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-left text-[11px] font-semibold uppercase text-erp-muted">
              <th className="px-2 py-2">Line Type</th>
              <th className="px-2 py-2">GL Account</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2">GST</th>
              <th className="px-2 py-2">TDS</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-b border-erp-border/60 align-top">
                <td className="px-2 py-2 min-w-[140px]">
                  <Select
                    className="h-8 text-[12px]"
                    value={line.lineType}
                    disabled={disabled}
                    onChange={(e) => updateLine(index, { lineType: e.target.value as AdjustmentLineInput['lineType'] })}
                  >
                    {LINE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-2 min-w-[180px]">
                  <Select
                    className="h-8 text-[12px]"
                    value={line.accountId ?? ''}
                    disabled={disabled}
                    onChange={(e) => updateLine(index, { accountId: e.target.value || null })}
                  >
                    <option value="">Select accountâ€¦</option>
                    {glAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountCode} â€” {a.accountName}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-2 min-w-[160px]">
                  <Input
                    className="h-8 text-[12px]"
                    value={line.description ?? ''}
                    disabled={disabled}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2 min-w-[110px]">
                  <Input
                    className="h-8 text-right text-[12px]"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(line.amount ?? '')}
                    disabled={disabled}
                    onChange={(e) => updateLine(index, { amount: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2 min-w-[190px]">
                  <div className="flex flex-col gap-1">
                    <Select
                      className="h-8 text-[12px]"
                      value={line.gstTreatment ?? 'GST_NOT_APPLICABLE'}
                      disabled={disabled}
                      onChange={(e) => updateLine(index, { gstTreatment: e.target.value as AdjustmentLineInput['gstTreatment'] })}
                    >
                      {GST_TREATMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    {line.gstTreatment && line.gstTreatment !== 'GST_NOT_APPLICABLE' ? (
                      <Input
                        className="h-8 text-[12px]"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="GST rate %"
                        value={String(line.gstRate ?? '')}
                        disabled={disabled}
                        onChange={(e) => updateLine(index, { gstRate: e.target.value })}
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2 min-w-[190px]">
                  <div className="flex flex-col gap-1">
                    <Select
                      className="h-8 text-[12px]"
                      value={line.tdsTreatment ?? 'TDS_NOT_APPLICABLE'}
                      disabled={disabled}
                      onChange={(e) => updateLine(index, { tdsTreatment: e.target.value as AdjustmentLineInput['tdsTreatment'] })}
                    >
                      {TDS_TREATMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    {line.tdsTreatment === 'TDS_DEDUCTED' ? (
                      <Input
                        className="h-8 text-[12px]"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="TDS rate %"
                        value={String(line.tdsRate ?? '')}
                        disabled={disabled}
                        onChange={(e) => updateLine(index, { tdsRate: e.target.value })}
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    disabled={disabled || lines.length <= 1}
                    onClick={() => removeLine(index)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2">
        <ErpButton type="button" variant="secondary" size="sm" icon={Plus} disabled={disabled} onClick={addLine}>
          Add line
        </ErpButton>
      </div>
    </div>
  )
}
