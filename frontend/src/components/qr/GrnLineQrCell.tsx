import { Link } from 'react-router-dom'
import { useQrStore } from '../../store/qrStore'

/** Per GRN line — shows Print QR when material lot QR exists for accepted/received qty */
export function GrnLineQrCell({ grnId, lineId, acceptedQty }: { grnId: string; lineId: string; acceptedQty: number }) {
  const lotQr = useQrStore((s) =>
    s.records.find(
      (r) =>
        r.entityType === 'MATERIAL_LOT' &&
        r.metadata.grnId === grnId &&
        r.metadata.grnLineId === lineId,
    ),
  )

  if (acceptedQty <= 0 && !lotQr) {
    return <span className="text-xs text-erp-muted">Pending accept</span>
  }
  if (!lotQr) {
    return <span className="text-xs text-amber-700">No QR — post GRN</span>
  }

  return (
    <Link to={`/qr/print/${lotQr.qrId}`} className="text-xs font-medium text-erp-accent hover:underline">
      QR Generated · Print
    </Link>
  )
}
