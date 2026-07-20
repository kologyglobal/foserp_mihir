import type { Prisma } from '@prisma/client'

/**
 * Stamp PR lines with the created PO (id + number snapshot) and mark CONVERTED.
 * Used by Planning→PO and RFQ award→PO — not user-editable fields.
 */
export async function linkPurchaseRequisitionLinesToOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  purchaseOrderId: string,
  purchaseOrderNumber: string,
  purchaseRequisitionLineIds: string[],
) {
  const ids = [...new Set(purchaseRequisitionLineIds.filter(Boolean))]
  if (ids.length === 0) return
  await tx.purchaseRequisitionLine.updateMany({
    where: { tenantId, id: { in: ids } },
    data: {
      status: 'CONVERTED',
      purchaseOrderId,
      purchaseOrderNumberSnapshot: purchaseOrderNumber,
    },
  })
}
