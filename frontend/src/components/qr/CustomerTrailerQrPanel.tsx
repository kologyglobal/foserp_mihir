import { useMemo } from 'react'
import { useQrStore } from '../../store/qrStore'
import { EntityQrToolbar } from './EntityQrToolbar'

export function CustomerTrailerQrPanel({ customerId, customerName }: { customerId: string; customerName: string }) {
  const records = useQrStore((s) => s.records)

  const trailers = useMemo(
    () =>
      records.filter(
        (r) =>
          r.entityType === 'FINISHED_TRAILER' &&
          (r.metadata.customerId === customerId || r.metadata.customerName === customerName),
      ),
    [records, customerId, customerName],
  )

  if (trailers.length === 0) return null

  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
      <p className="mb-3 text-sm font-semibold">Trailer QR Codes</p>
      <div className="space-y-3">
        {trailers.map((t) => (
          <div key={t.qrId} className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border pb-2 last:border-0">
            <span className="font-mono text-sm">{t.displayCode}</span>
            <EntityQrToolbar
              entityType="FINISHED_TRAILER"
              entityId={t.entityId}
              displayCode={t.displayCode}
              metadata={t.metadata as never}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
