import type { Prisma } from '@prisma/client'

export type PrLinePoLinkInput = {
  purchaseRequisitionLineId: string
  orderedQuantity: number
}

/**
 * Stamp PR lines with PO link and qty-aware conversion status.
 * Sets PARTIALLY_CONVERTED when ordered qty < required; CONVERTED when fully covered.
 */
export async function linkPurchaseRequisitionLinesToOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  purchaseOrderId: string,
  purchaseOrderNumber: string,
  lineLinks: PrLinePoLinkInput[] | string[],
) {
  const normalized: PrLinePoLinkInput[] = lineLinks.map((entry) =>
    typeof entry === 'string'
      ? { purchaseRequisitionLineId: entry, orderedQuantity: NaN }
      : entry,
  )

  const byLine = new Map<string, number>()
  for (const link of normalized) {
    if (!link.purchaseRequisitionLineId) continue
    const prev = byLine.get(link.purchaseRequisitionLineId) ?? 0
    const delta = Number(link.orderedQuantity)
    byLine.set(
      link.purchaseRequisitionLineId,
      prev + (Number.isFinite(delta) ? delta : 0),
    )
  }

  for (const [lineId, deltaQty] of byLine.entries()) {
    const line = await tx.purchaseRequisitionLine.findFirst({
      where: { tenantId, id: lineId },
      select: { id: true, requiredQuantity: true, orderedQuantity: true, purchaseOrderId: true },
    })
    if (!line) continue

    const required = Number(line.requiredQuantity) || 0
    const currentOrdered = Number(line.orderedQuantity) || 0
    const addQty =
      deltaQty > 0
        ? deltaQty
        : required - currentOrdered > 0
          ? required - currentOrdered
          : required
    const nextOrdered = currentOrdered + addQty
    const fullyConverted = nextOrdered >= required - 1e-6

    await tx.purchaseRequisitionLine.update({
      where: { id: line.id },
      data: {
        orderedQuantity: nextOrdered,
        status: fullyConverted ? 'CONVERTED' : 'PARTIALLY_CONVERTED',
        purchaseOrderId: line.purchaseOrderId ?? purchaseOrderId,
        purchaseOrderNumberSnapshot: purchaseOrderNumber,
      },
    })
  }
}
