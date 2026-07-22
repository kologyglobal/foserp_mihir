import { formatDate } from '@/utils/dates/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { ProductionPlanDemandLine } from '../types'
import { DEMAND_SOURCE_TYPE_LABELS } from '../utils/labels'

/** Read-only demand line register for a production plan — items, source, required qty/date. */
export function DemandTable({ lines }: { lines: ProductionPlanDemandLine[] }) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No demand lines"
        description="Calculate the plan to pull unplanned demand into lines."
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="erp-table w-full text-[12px]">
        <thead>
          <tr>
            <th>Item</th>
            <th>Source</th>
            <th className="text-right">Demand Qty</th>
            <th className="text-right">Net Requirement</th>
            <th>Required Date</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <p className="font-mono text-[11px] font-medium text-erp-text">{line.itemCode}</p>
                <p className="text-[11px] text-erp-muted">{line.itemName}</p>
              </td>
              <td>
                <p>{DEMAND_SOURCE_TYPE_LABELS[line.sourceType]}</p>
                {line.sourceDocumentNo ? (
                  <p className="font-mono text-[10px] text-erp-muted">{line.sourceDocumentNo}</p>
                ) : null}
              </td>
              <td className="text-right tabular-nums">
                {line.demandQuantity} {line.uomCode}
              </td>
              <td className="text-right tabular-nums font-semibold">
                {line.netRequirement} {line.uomCode}
              </td>
              <td className="whitespace-nowrap">{line.requiredDate ? formatDate(line.requiredDate) : '—'}</td>
              <td className="max-w-[200px] truncate text-erp-muted" title={line.notes ?? undefined}>
                {line.notes || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
