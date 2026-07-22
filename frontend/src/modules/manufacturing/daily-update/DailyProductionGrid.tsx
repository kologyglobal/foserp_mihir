import type { DailyProductionBatch, DailyProductionLine } from '@/types/manufacturingPhase2b'
import { DAILY_BATCH_STATUS_LABELS } from '@/types/manufacturingPhase2b'
import { Input } from '@/components/forms/Inputs'
import { Button } from '@/design-system/components/Button'

interface DailyProductionGridProps {
  batch: DailyProductionBatch
  readOnly?: boolean
  busy?: boolean
  onLineChange: (lineId: string, patch: Partial<DailyProductionLine>) => void
  onRemoveLine: (lineId: string) => void
}

function shortRef(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

/** Editable grid of daily production lines (supervisor batch entry). */
export function DailyProductionGrid({ batch, readOnly, busy, onLineChange, onRemoveLine }: DailyProductionGridProps) {
  const lines = batch.lines ?? []

  const totals = lines.reduce(
    (acc, line) => ({
      good: acc.good + (Number(line.goodQuantity) || 0),
      rework: acc.rework + (Number(line.reworkQuantity) || 0),
      rejected: acc.rejected + (Number(line.rejectedQuantity) || 0),
      scrap: acc.scrap + (Number(line.scrapQuantity) || 0),
    }),
    { good: 0, rework: 0, rejected: 0, scrap: 0 },
  )

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-erp-border bg-white px-4 py-10 text-center text-[13px] text-erp-muted">
        No lines yet — add production output rows.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
      <table className="erp-table w-full min-w-[720px] text-[12px]">
        <thead>
          <tr>
            <th>WO</th>
            <th>Stage</th>
            <th className="text-right">Good</th>
            <th className="text-right">Rework</th>
            <th className="text-right">Rejected</th>
            <th className="text-right">Scrap</th>
            <th>Remarks</th>
            {!readOnly ? <th className="w-20" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="font-mono text-[11px] text-erp-text" title={line.productionOrderId}>
                {shortRef(line.productionOrderId)}
              </td>
              <td className="font-mono text-[11px] text-erp-muted" title={line.stageId}>
                {shortRef(line.stageId)}
              </td>
              {(['goodQuantity', 'reworkQuantity', 'rejectedQuantity', 'scrapQuantity'] as const).map((field) => (
                <td key={field} className="text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{line[field]}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 min-h-8 w-[4.5rem] text-right tabular-nums"
                      value={line[field]}
                      disabled={busy}
                      onChange={(e) => onLineChange(line.id, { [field]: e.target.value } as Partial<DailyProductionLine>)}
                    />
                  )}
                </td>
              ))}
              <td>
                {readOnly ? (
                  <span className="text-erp-muted">{line.remarks || '—'}</span>
                ) : (
                  <Input
                    className="h-8 min-h-8"
                    value={line.remarks ?? ''}
                    disabled={busy}
                    onChange={(e) => onLineChange(line.id, { remarks: e.target.value })}
                  />
                )}
              </td>
              {!readOnly ? (
                <td className="text-right">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRemoveLine(line.id)}>
                    Remove
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-erp-border bg-erp-surface text-[12px] font-semibold">
            <td colSpan={2}>{DAILY_BATCH_STATUS_LABELS[batch.status]} · {lines.length} line(s)</td>
            <td className="text-right tabular-nums">{totals.good}</td>
            <td className="text-right tabular-nums">{totals.rework}</td>
            <td className="text-right tabular-nums">{totals.rejected}</td>
            <td className="text-right tabular-nums">{totals.scrap}</td>
            <td colSpan={readOnly ? 1 : 2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
