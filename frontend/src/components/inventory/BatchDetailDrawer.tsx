import { useEffect, useState } from 'react'
import { CrmDrawerShell } from '../crm/CrmDrawerShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getBatchById } from '@/services/inventory/traceabilityService'
import type { InventoryBatchRecord } from '@/types/inventoryDomain'
import { BATCH_STATUS_LABELS } from '@/utils/inventoryTraceabilityLabels'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'

export interface BatchDetailDrawerProps {
  open: boolean
  batchId: string | null
  onClose: () => void
  onTrace?: (batchId: string) => void
}

export function BatchDetailDrawer({ open, batchId, onClose, onTrace }: BatchDetailDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [batch, setBatch] = useState<InventoryBatchRecord | null>(null)

  useEffect(() => {
    if (!open || !batchId) {
      setBatch(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getBatchById(batchId)
      .then((b) => {
        if (!cancelled) setBatch(b)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, batchId])

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title={batch ? batch.batchNo : 'Batch Details'}
      subtitle={batch ? `${batch.itemCode} — ${batch.itemName}` : undefined}
      width="md"
      footer={batch && onTrace ? (
        <button
          type="button"
          className="erp-btn erp-btn-secondary h-9 px-4 text-[13px]"
          onClick={() => onTrace(batch.id)}
        >
          View Traceability
        </button>
      ) : undefined}
    >
      {loading ? <LoadingState variant="card" /> : null}
      {!loading && !batch ? <p className="text-sm text-erp-muted">Batch not found.</p> : null}
      {!loading && batch ? (
        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <Field label="Batch Number" value={batch.batchNo} mono />
          <Field label="Supplier Batch" value={batch.supplierBatchNo ?? '—'} mono />
          <Field label="Item" value={`${batch.itemCode} — ${batch.itemName}`} />
          <Field label="Warehouse" value={batch.warehouseName} />
          <Field label="Manufacturing Date" value={batch.manufacturingDate ? formatDate(batch.manufacturingDate) : '—'} />
          <Field label="Expiry Date" value={batch.expiryDate ? formatDate(batch.expiryDate) : '—'} />
          <Field label="Receipt Date" value={formatDate(batch.receiptDate)} />
          <Field label="Available Qty" value={formatNumber(batch.availableQty)} />
          <Field label="Reserved Qty" value={formatNumber(batch.reservedQty)} />
          <Field label="Quality Status" value={BATCH_STATUS_LABELS[batch.qualityStatus]} />
          <Field label="Source Document" value={`${batch.sourceDocumentType} ${batch.sourceDocumentNo}`} mono />
        </dl>
      ) : null}
    </CrmDrawerShell>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-erp-border bg-erp-bg-subtle/40 px-3 py-2">
      <dt className="text-erp-muted">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono font-semibold text-erp-text' : 'mt-0.5 font-semibold text-erp-text'}>
        {value}
      </dd>
    </div>
  )
}
