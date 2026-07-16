import type { ReactNode } from 'react'
import type { BatchSelectionMethod, InventoryIssue, InventoryReceipt, MovementLine } from '@/types/inventoryDomain'
import {
  ISSUE_SOURCE_LABELS,
  ISSUE_STATUS_LABELS,
  RECEIPT_SOURCE_LABELS,
  RECEIPT_STATUS_LABELS,
} from '@/utils/inventoryMovementLabels'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { BatchSelector } from '@/components/inventory/BatchSelector'
import { SerialSelector } from '@/components/inventory/SerialSelector'

export function MovementDemoBanner() {
  return (
    <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      Demo mode — posting updates the inventory ledger locally. No live GL or backend API.
    </p>
  )
}

export function MovementDocumentHeader({
  doc,
}: {
  doc: InventoryReceipt | InventoryIssue
}) {
  const statusLabels = doc.movementType === 'receipt' ? RECEIPT_STATUS_LABELS : ISSUE_STATUS_LABELS
  const sourceLabels = doc.movementType === 'receipt' ? RECEIPT_SOURCE_LABELS : ISSUE_SOURCE_LABELS
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
      <div><dt className="text-erp-muted">Document No</dt><dd className="font-mono font-semibold">{doc.documentNumber}</dd></div>
      <div><dt className="text-erp-muted">Movement Type</dt><dd className="capitalize">{doc.movementType}</dd></div>
      <div><dt className="text-erp-muted">Document Date</dt><dd>{formatDate(doc.documentDate)}</dd></div>
      <div><dt className="text-erp-muted">Posting Date</dt><dd>{formatDate(doc.postingDate)}</dd></div>
      <div><dt className="text-erp-muted">Source Type</dt><dd>{sourceLabels[doc.sourceType as keyof typeof sourceLabels]}</dd></div>
      <div><dt className="text-erp-muted">Source Document</dt><dd>{doc.sourceDocumentNo ?? '—'}</dd></div>
      <div><dt className="text-erp-muted">Warehouse</dt><dd>{doc.warehouseName}</dd></div>
      <div><dt className="text-erp-muted">Plant</dt><dd>{doc.plantCode}</dd></div>
      <div><dt className="text-erp-muted">Status</dt><dd>{statusLabels[doc.status as keyof typeof statusLabels]}</dd></div>
      <div><dt className="text-erp-muted">Created By</dt><dd>{doc.createdBy}</dd></div>
      <div><dt className="text-erp-muted">Approved By</dt><dd>{doc.approvedBy ?? '—'}</dd></div>
      <div><dt className="text-erp-muted">Posted By</dt><dd>{doc.postedBy ?? '—'}</dd></div>
    </dl>
  )
}

interface MovementLineGridProps {
  lines: MovementLine[]
  mode: 'receipt' | 'issue'
  editable?: boolean
  batchMethod?: BatchSelectionMethod
  onLineChange?: (lineId: string, patch: Partial<MovementLine>) => void
}

export function MovementLineGrid({ lines, mode, editable, batchMethod = 'fefo', onLineChange }: MovementLineGridProps) {
  const qtyField = mode === 'receipt' ? 'receivedQty' : 'issuedQty'
  return (
    <div className="overflow-x-auto">
      <table className="erp-table w-full min-w-[900px]">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th className="text-right">Pending</th>
            <th className="text-right">Available</th>
            <th className="text-right">{mode === 'receipt' ? 'Receive' : 'Issue'}</th>
            {mode === 'receipt' ? (
              <>
                <th className="text-right">Accepted</th>
                <th className="text-right">Rejected</th>
                <th className="text-right">Quarantine</th>
              </>
            ) : null}
            <th>Batch</th>
            <th>Serial</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const qty = line[qtyField]
            return (
            <tr key={line.id}>
              <td>{line.lineNo}</td>
              <td><span className="font-mono text-xs">{line.itemCode}</span> {line.itemName}</td>
              <td className="text-right font-mono">{line.pendingQty}</td>
              <td className="text-right font-mono">{line.availableQty}</td>
              <td className="text-right">
                {editable && onLineChange ? (
                  <input
                    type="number"
                    min={0}
                    className="erp-input h-8 w-20 text-right font-mono"
                    value={line[qtyField]}
                    onChange={(e) => onLineChange(line.id, { [qtyField]: Number(e.target.value) } as Partial<MovementLine>)}
                  />
                ) : (
                  <span className="font-mono">{line[qtyField]}</span>
                )}
              </td>
              {mode === 'receipt' ? (
                <>
                  <td className="text-right font-mono">{line.acceptedQty}</td>
                  <td className="text-right font-mono">{line.rejectedQty}</td>
                  <td className="text-right font-mono">{line.quarantineQty}</td>
                </>
              ) : null}
              <td className="min-w-[160px]">
                {line.batchTracking && qty > 0 && editable && onLineChange ? (
                  <BatchSelector
                    itemId={line.itemId}
                    warehouseId={line.warehouseId}
                    qty={qty}
                    value={line.batchNo}
                    method={batchMethod}
                    onChange={(batchNo) => onLineChange(line.id, { batchNo })}
                  />
                ) : (
                  <span className="font-mono text-xs">{line.batchNo ?? '—'}</span>
                )}
              </td>
              <td className="min-w-[180px]">
                {line.serialTracking && qty > 0 && editable && onLineChange ? (
                  <SerialSelector
                    itemId={line.itemId}
                    warehouseId={line.warehouseId}
                    requiredQty={Math.floor(qty)}
                    value={line.serialNo ? [line.serialNo] : []}
                    onChange={(serials) => onLineChange(line.id, { serialNo: serials[0] ?? null })}
                  />
                ) : (
                  <span className="font-mono text-xs">{line.serialNo ?? '—'}</span>
                )}
              </td>
              <td>
                {line.expiryTracking && editable && onLineChange ? (
                  <input
                    type="date"
                    className="erp-input h-8 text-[12px]"
                    value={line.expiryDate ?? ''}
                    onChange={(e) => onLineChange(line.id, { expiryDate: e.target.value })}
                  />
                ) : (line.expiryDate ?? '—')}
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}

export function MovementPreviewPanels({ doc }: { doc: InventoryReceipt | InventoryIssue }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {doc.costPreview ? (
        <section className="rounded-lg border border-erp-border p-4">
          <h4 className="mb-2 text-sm font-semibold">Cost Preview</h4>
          <table className="erp-table w-full text-[12px]">
            <tbody>
              {doc.costPreview.lines.map((l) => (
                <tr key={l.itemCode}><td>{l.itemCode}</td><td className="text-right font-mono">{l.qty}</td><td className="text-right">{formatCurrency(l.amount)}</td></tr>
              ))}
              <tr><td colSpan={2}><strong>Total</strong></td><td className="text-right"><strong>{formatCurrency(doc.costPreview.total)}</strong></td></tr>
            </tbody>
          </table>
        </section>
      ) : null}
      {doc.accountingPreview ? (
        <section className="rounded-lg border border-erp-border p-4">
          <h4 className="mb-2 text-sm font-semibold">Accounting Preview</h4>
          <p className="text-[13px]">Dr {doc.accountingPreview.debitAccount}</p>
          <p className="text-[13px]">Cr {doc.accountingPreview.creditAccount}</p>
          <p className="mt-2 font-mono">{formatCurrency(doc.accountingPreview.amount)}</p>
          <p className="mt-1 text-[12px] text-erp-muted">{doc.accountingPreview.narration}</p>
        </section>
      ) : null}
    </div>
  )
}

export function MovementAuditSection({ doc }: { doc: InventoryReceipt | InventoryIssue }) {
  if (doc.auditHistory.length === 0) return null
  return (
    <section className="mt-6 rounded-lg border border-erp-border p-4">
      <h4 className="mb-2 text-sm font-semibold">Audit History</h4>
      <table className="erp-table w-full text-[12px]">
        <thead><tr><th>Action</th><th>User</th><th>When</th></tr></thead>
        <tbody>
          {doc.auditHistory.map((a) => (
            <tr key={a.id}><td>{a.action}</td><td>{a.userName}</td><td>{formatDate(a.timestamp)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function MovementWizardSteps({ step, steps }: { step: number; steps: string[] }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {steps.map((label, i) => (
        <li key={label} className={`rounded-full px-3 py-1 text-[12px] font-medium ${i + 1 === step ? 'bg-erp-primary text-white' : i + 1 < step ? 'bg-green-100 text-green-800' : 'bg-erp-bg-subtle text-erp-muted'}`}>
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  )
}

export function MovementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}
