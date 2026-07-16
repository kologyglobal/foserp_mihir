import { ExternalLink } from 'lucide-react'
import { TableLink } from '@/components/ui/AppLink'
import { formatCurrency } from '@/utils/formatters/currency'
import { PayableDrawerShell } from './PayableDrawerShell'
import { PayableMatchStatusBadge, type PayableMatchStatus } from './PayableStatusBadge'
import { cn } from '@/utils/cn'

export interface ThreeWayMatchLine {
  field: string
  poValue: number | string
  grnValue: number | string
  invoiceValue: number | string
  difference: number | string | null
  tolerance: number | string | null
  withinTolerance: boolean
}

export interface ThreeWayMatchResult {
  invoiceNumber: string
  poNumber: string
  grnNumber: string
  vendorName: string
  matchStatus: PayableMatchStatus
  lines: ThreeWayMatchLine[]
  sourceLinks?: { label: string; href: string }[]
}

function formatCell(value: number | string): string {
  if (typeof value === 'number') return formatCurrency(value)
  return value
}

export function ThreeWayMatchDrawer({
  open,
  onClose,
  result,
}: {
  open: boolean
  onClose: () => void
  result: ThreeWayMatchResult | null
}) {
  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title="Three-way match"
      subtitle={result ? `${result.invoiceNumber} · ${result.vendorName}` : undefined}
      eyebrow="Payables · Invoice matching"
      widthClassName="max-w-2xl"
    >
      {!result ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">No match data available.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PayableMatchStatusBadge status={result.matchStatus} />
            <span className="text-[12px] text-erp-muted">
              PO {result.poNumber} · GRN {result.grnNumber}
            </span>
          </div>

          {result.sourceLinks && result.sourceLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.sourceLinks.map((link) => (
                <TableLink
                  key={link.href}
                  to={link.href}
                  className="inline-flex items-center gap-1 text-[12px]"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </TableLink>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-erp-border">
            <table className="erp-table w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Field</th>
                  <th className="px-3 py-2 text-right font-semibold">PO</th>
                  <th className="px-3 py-2 text-right font-semibold">GRN</th>
                  <th className="px-3 py-2 text-right font-semibold">Invoice</th>
                  <th className="px-3 py-2 text-right font-semibold">Difference</th>
                  <th className="px-3 py-2 text-right font-semibold">Tolerance</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.field} className="border-b border-erp-border/80">
                    <td className="px-3 py-2 font-medium text-erp-text">{line.field}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCell(line.poValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCell(line.grnValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCell(line.invoiceValue)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        !line.withinTolerance && 'font-semibold text-rose-700',
                      )}
                    >
                      {line.difference == null ? '—' : formatCell(line.difference)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-erp-muted">
                      {line.tolerance == null ? '—' : formatCell(line.tolerance)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1',
                          line.withinTolerance
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                            : 'bg-rose-50 text-rose-800 ring-rose-200',
                        )}
                      >
                        {line.withinTolerance ? 'OK' : 'Variance'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-erp-muted">
            Read-only comparison — PO, GRN and invoice values are shown for review. No posting occurs from this drawer.
          </p>
        </div>
      )}
    </PayableDrawerShell>
  )
}
