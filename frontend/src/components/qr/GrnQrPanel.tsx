import { Link } from 'react-router-dom'
import { Printer, GitBranch, QrCode } from 'lucide-react'
import { useQrStore } from '../../store/qrStore'
import { EntityQrToolbar } from './EntityQrToolbar'
import { QrStatusBadge } from './QrStatusBadge'

interface GrnQrPanelProps {
  grnId: string
  grnNo: string
  className?: string
}

/** Shows auto-generated GRN / material lot QRs — keyed by grnId, not line id */
export function GrnQrPanel({ grnId, grnNo, className }: GrnQrPanelProps) {
  const qrs = useQrStore((s) =>
    s.records.filter(
      (r) =>
        r.metadata.grnId === grnId &&
        (r.entityType === 'MATERIAL_LOT' || (r.entityType === 'GRN_LINE' && r.entityId === grnId)),
    ),
  )
  const headerQr = qrs.find((r) => r.entityType === 'GRN_LINE' && r.entityId === grnId)
  const lotQrs = qrs.filter((r) => r.entityType === 'MATERIAL_LOT')

  if (qrs.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/30 p-3 ${className ?? ''}`}>
        <p className="mb-2 text-xs text-erp-muted">
          No QR yet — post GRN from the PO to auto-generate material lot labels.
        </p>
        <EntityQrToolbar
          entityType="GRN_LINE"
          entityId={grnId}
          displayCode={grnNo}
          metadata={{ grnId, grnNo }}
          payload={{ grn: grnNo }}
        />
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">GRN QR</p>
        {headerQr ? (
          <GrnQrActions qr={headerQr} />
        ) : lotQrs[0] ? (
          <GrnQrActions qr={lotQrs[0]} />
        ) : null}
      </div>

      {lotQrs.length > 0 && (
        <div className="rounded-lg border border-erp-border bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">Material Lot Labels ({lotQrs.length})</p>
          <ul className="space-y-2">
            {lotQrs.map((lot) => {
              const itemCode = lot.metadata.itemCode ?? '—'
              return (
                <li
                  key={lot.qrId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border pb-2 last:border-0 last:pb-0"
                >
                  <div className="text-sm">
                    <span className="font-mono font-medium">{lot.displayCode}</span>
                    <span className="ml-2 text-erp-muted">{itemCode}</span>
                    <span className="ml-2">
                      <QrStatusBadge status={lot.status} />
                    </span>
                  </div>
                  <GrnQrActions qr={lot} compact />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function GrnQrActions({ qr, compact }: { qr: { qrId: string; displayCode: string }; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
        <QrCode className="h-3.5 w-3.5" /> QR Generated
      </span>
      <Link
        to={`/qr/print/${qr.qrId}`}
        className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent"
      >
        <Printer className="h-3.5 w-3.5" /> Print QR
      </Link>
      <Link
        to={`/traceability?qr=${encodeURIComponent(qr.displayCode)}`}
        className={`inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent ${compact ? '' : ''}`}
      >
        <GitBranch className="h-3.5 w-3.5" /> View Traceability
      </Link>
    </div>
  )
}
