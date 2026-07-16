import type { BarcodeRecord } from '../../types/barcode'
import { BARCODE_ENTITY_LABELS } from '../../types/barcode'

interface BarcodeLabelPrintProps {
  labels: BarcodeRecord[]
}

export function BarcodeLabelPrint({ labels }: BarcodeLabelPrintProps) {
  if (labels.length === 0) {
    return <p className="text-sm text-erp-muted">Select barcodes to preview labels.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-erp-accent px-3 py-2 text-sm font-medium text-white"
        >
          Print Labels
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
        {labels.map((label) => (
          <div
            key={label.barcodeId}
            className="rounded border-2 border-dashed border-erp-border bg-white p-4 print:break-inside-avoid"
          >
            <p className="text-xs font-semibold uppercase text-erp-muted">{BARCODE_ENTITY_LABELS[label.entityType]}</p>
            <p className="mt-1 truncate text-sm font-medium">{label.entityLabel}</p>
            <p className="mt-3 font-mono text-lg font-bold tracking-wider">{label.barcodeValue}</p>
            <div className="mt-2 h-12 rounded bg-[repeating-linear-gradient(90deg,#111_0_2px,transparent_2px_6px)] opacity-80" aria-hidden />
            <p className="mt-2 break-all font-mono text-[10px] text-erp-muted">{label.qrValue}</p>
            <p className="mt-2 text-xs text-erp-muted">ID {label.barcodeId} · {label.createdDate}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
