import { Link } from 'react-router-dom'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { ErpViewField } from '@/components/erp/card-form/ErpViewField'
import { TableLink } from '@/components/ui/AppLink'
import {
  PurchaseAuditTimeline,
  buildDemoPurchaseTimeline,
} from '@/components/purchase/PurchaseAuditTimeline'
import {
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_PURCHASE_TYPE_LABELS,
  PURCHASE_PLANNING_STATUS_LABELS,
} from '@/services/purchase'
import type { PurchasePlanningSheetRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'

type Props = {
  open: boolean
  row: PurchasePlanningSheetRow | null
  onClose: () => void
  onEdit?: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-erp-border pb-4 last:border-b-0 last:pb-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function PurchasePlanningViewDrawer({ open, row, onClose, onEdit }: Props) {
  if (!row) return null

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title={row.planningNumber}
      subtitle={`${row.itemCode} · ${row.itemName}`}
      eyebrow="Purchase"
      width="lg"
      footer={
        onEdit ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={onClose}>
              Close
            </button>
            <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={onEdit}>
              Edit Planning
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5 p-1">
        <Section title="Source Requisition">
          <ErpViewField
            label="PR Number"
            value={
              <TableLink to={`/purchase/requisitions/${row.purchaseRequisitionId}`}>
                {row.purchaseRequisitionNumber}
              </TableLink>
            }
          />
          <ErpViewField label="PR Line" value={row.purchaseRequisitionLineId || '—'} />
          <ErpViewField label="Department" value={row.department || '—'} />
          <ErpViewField label="Requested By" value={row.requestedByName || '—'} />
          <ErpViewField label="Planning Date" value={formatDate(row.planningDate)} />
          <ErpViewField
            label="Status"
            value={PURCHASE_PLANNING_STATUS_LABELS[row.status] ?? row.status}
          />
        </Section>

        <Section title="Item Details">
          <ErpViewField label="Item Code" value={row.itemCode || '—'} />
          <ErpViewField label="Item Name" value={row.itemName || '—'} />
          <ErpViewField label="Specification" value={row.specification || '—'} />
          <ErpViewField label="UOM" value={row.uom || '—'} />
        </Section>

        <Section title="Quantity Planning">
          <ErpViewField label="Required Quantity" value={String(row.requiredQuantity)} />
          <ErpViewField label="Current Stock" value={String(row.currentStock)} />
          <ErpViewField label="Open PO Quantity" value={String(row.openPoQuantity)} />
          <ErpViewField label="Net Purchase Quantity" value={String(row.netPurchaseQuantity)} />
          <ErpViewField
            label="Required Date"
            value={row.requiredByDate ? formatDate(row.requiredByDate) : '—'}
          />
        </Section>

        <Section title="Vendor and Rate">
          <ErpViewField label="Selected Vendor" value={row.preferredVendorName || '—'} />
          <ErpViewField label="Vendor Code" value={row.preferredVendorCode || '—'} />
          <ErpViewField label="Expected Rate" value={formatCurrency(row.expectedRate)} />
          <ErpViewField
            label="Negotiated Rate"
            value={row.negotiatedRate == null ? '—' : formatCurrency(row.negotiatedRate)}
          />
          <ErpViewField label="Estimated Amount" value={formatCurrency(row.estimatedAmount)} />
          <ErpViewField
            label="Purchase Type"
            value={PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[row.purchaseType] ?? row.purchaseType}
          />
        </Section>

        <Section title="Buyer and Priority">
          <ErpViewField label="Buyer" value={row.buyerName || '—'} />
          <ErpViewField
            label="Priority"
            value={PURCHASE_PLANNING_PRIORITY_LABELS[row.priority] ?? row.priority}
          />
          <ErpViewField label="Remarks" value={row.remarks || '—'} />
        </Section>

        <Section title="PO Conversion">
          <ErpViewField
            label="PO Reference"
            value={
              row.purchaseOrderId && row.purchaseOrderNumber ? (
                <TableLink to={`/purchase/orders/${row.purchaseOrderId}`}>
                  {row.purchaseOrderNumber}
                </TableLink>
              ) : (
                '—'
              )
            }
          />
          <ErpViewField
            label="View PR"
            value={
              <Link
                to={`/purchase/requisitions/${row.purchaseRequisitionId}`}
                className="text-[13px] font-medium text-erp-primary hover:underline"
              >
                Open requisition
              </Link>
            }
          />
        </Section>

        <PurchaseAuditTimeline
          entityType="planning-row"
          entityId={row.id}
          title="Audit Timeline"
          className="border-0 p-0 shadow-none"
          demoEvents={buildDemoPurchaseTimeline({
            entityId: row.id,
            entityType: 'PurchasePlanningRow',
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            updatedAt: row.updatedAt,
            updatedBy: row.updatedBy,
            statusLabel: PURCHASE_PLANNING_STATUS_LABELS[row.status] ?? row.status,
          })}
        />
      </div>
    </CrmDrawerShell>
  )
}
