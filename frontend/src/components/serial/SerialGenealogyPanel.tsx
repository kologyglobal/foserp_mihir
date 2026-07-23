import { Link } from 'react-router-dom'
import { useSerialStore } from '../../store/serialStore'
import { SERIAL_TYPE_LABELS } from '../../types/serialNumber'
import { StatusBadge } from '../ui/StatusBadge'

type Props = {
  workOrderId?: string | null
  customerId?: string | null
  grnId?: string | null
  itemId?: string | null
  vendorId?: string | null
  trailerNo?: string | null
  compact?: boolean
}

export function SerialGenealogyPanel({ workOrderId, customerId, grnId, itemId, vendorId, trailerNo, compact = false }: Props) {
  const serials = useSerialStore((s) =>
    s.listSerials({
      workOrderId: workOrderId ?? undefined,
      customerId: customerId ?? undefined,
      grnId: grnId ?? undefined,
      itemId: itemId ?? undefined,
      vendorId: vendorId ?? undefined,
    }).filter((r) => !trailerNo || r.installedTrailerNo === trailerNo || r.serialNo === trailerNo),
  )

  if (serials.length === 0) {
    if (compact) return null
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/30 p-4 text-sm text-erp-muted">
        No serial numbers linked to this record.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-erp-text">Serial Numbers</h3>
        <Link to="/manufacturing/traceability" className="text-xs text-blue-600 hover:underline">
          Open register
        </Link>
      </div>
      <ul className="space-y-2">
        {serials.slice(0, compact ? 5 : 20).map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <div>
              <Link to="/manufacturing/traceability" className="font-medium text-blue-600">
                {s.serialNo}
              </Link>
              <p className="text-xs text-erp-muted">
                {SERIAL_TYPE_LABELS[s.serialType]}
                {s.itemCode ? ` · ${s.itemCode}` : ''}
              </p>
            </div>
            <StatusBadge status={s.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SerialSummaryChips({ serialNos }: { serialNos: string[] }) {
  if (serialNos.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {serialNos.map((no) => (
        <Link
          key={no}
          to={`/traceability/components/${encodeURIComponent(no)}`}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {no}
        </Link>
      ))}
    </div>
  )
}
