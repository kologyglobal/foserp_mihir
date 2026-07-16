import { Link, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Printer, QrCode, ScanLine, GitBranch } from 'lucide-react'
import { useQrStore } from '../../store/qrStore'
import type { QrEntityType } from '../../types/qrTraceability'
import { ensureEntityQr } from '../../store/qrStore'
import { ensureJobCardQr, ensureWorkOrderQr } from '../../utils/qrIntegration'

interface EntityQrToolbarProps {
  entityType: QrEntityType
  entityId: string
  displayCode: string
  metadata?: Record<string, string | number | undefined>
  payload?: Record<string, string | undefined>
  className?: string
}

export function EntityQrToolbar({
  entityType,
  entityId,
  displayCode,
  metadata,
  payload,
  className,
}: EntityQrToolbarProps) {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const records = useQrStore((s) => s.records)
  const existing = useMemo(
    () => useQrStore.getState().getForEntity(entityType, entityId)[0],
    [records, entityType, entityId],
  )

  function generate() {
    if (existing) {
      setNotice('QR already generated — use Reprint QR to print again.')
      return
    }
    if (entityType === 'JOB_CARD') {
      ensureJobCardQr(entityId)
      return
    }
    if (entityType === 'WORK_ORDER') {
      ensureWorkOrderQr(entityId)
      return
    }
    ensureEntityQr({
      entityType,
      entityId,
      displayCode,
      metadata: metadata as never,
      payload,
    })
    setNotice(null)
  }

  const qrId = existing?.qrId

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={generate}
        className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent"
      >
        <QrCode className="h-3.5 w-3.5" /> {existing ? 'QR Generated' : 'Generate QR'}
      </button>
      {qrId && (
        <>
          <Link
            to={`/qr/print/${qrId}`}
            className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent"
          >
            <Printer className="h-3.5 w-3.5" /> Print QR
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/scan?qr=${encodeURIComponent(existing.qrCode)}`)}
            className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent"
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan QR
          </button>
          <Link
            to={`/traceability?qr=${encodeURIComponent(existing.displayCode)}`}
            className="inline-flex items-center gap-1 rounded border border-erp-border px-2 py-1 text-xs hover:border-erp-accent"
          >
            <GitBranch className="h-3.5 w-3.5" /> View Traceability
          </Link>
        </>
      )}
      </div>
      {notice && <p className="text-xs text-amber-700">{notice}</p>}
    </div>
  )
}
