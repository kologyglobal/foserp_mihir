import type { PurchaseReturn, PurchaseReturnLine } from '@prisma/client'
import { returnAllowedActions, returnQty } from './purchase-return.workflow.js'

const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null

export type PurchaseReturnLineEnrichment = {
  uom: string
  uomId: string | null
  receivedQuantity: number
  batchNumber: string | null
  lotNumber: string | null
  serialNumber: string | null
}

export type PurchaseReturnEnrichment = {
  purchaseOrderNumber?: string | null
  goodsReceiptNumber?: string | null
  qualityInspectionNumber?: string | null
  lineById?: Map<string, PurchaseReturnLineEnrichment>
}

export function mapPurchaseReturn(
  row: PurchaseReturn & { lines: PurchaseReturnLine[] },
  enrichment?: PurchaseReturnEnrichment,
) {
  return {
    ...row,
    documentNumber: row.returnNumber,
    documentDate: date(row.returnDate),
    returnDate: date(row.returnDate),
    purchaseOrderNumber: enrichment?.purchaseOrderNumber ?? null,
    goodsReceiptNumber: enrichment?.goodsReceiptNumber ?? null,
    qualityInspectionNumber: enrichment?.qualityInspectionNumber ?? null,
    returnType: (row as { returnType?: string }).returnType ?? 'CREDIT',
    decisionCode: (row as { decisionCode?: string | null }).decisionCode ?? null,
    accountingStatus: (row as { accountingStatus?: string }).accountingStatus ?? 'NONE',
    ncrId: (row as { ncrId?: string | null }).ncrId ?? null,
    replacementGoodsReceiptId: (row as { replacementGoodsReceiptId?: string | null }).replacementGoodsReceiptId ?? null,
    replacedReturnId: (row as { replacedReturnId?: string | null }).replacedReturnId ?? null,
    vendorAdjustmentId: row.vendorAdjustmentId ?? null,
    vendorAdjustmentDraftRef: row.vendorAdjustmentDraftRef ?? null,
    vendorAdjustmentHref: row.vendorAdjustmentId
      ? `/accounting/money-out/vendor-adjustments/${row.vendorAdjustmentId}`
      : null,
    submittedAt: iso(row.submittedAt),
    shippedAt: iso((row as { shippedAt?: Date | null }).shippedAt),
    completedAt: iso(row.completedAt),
    cancelledAt: iso(row.cancelledAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    allowedActions: returnAllowedActions(row.status, row.deletedAt),
    totalAmount: row.lines.reduce((sum, line) => sum + returnQty(line.amount), 0),
    totalQuantity: row.lines.reduce((sum, line) => sum + returnQty(line.returnQuantity), 0),
    lines: row.lines.map((line) => {
      const ctx = enrichment?.lineById?.get(line.id)
      return {
        ...line,
        uomId: ctx?.uomId ?? null,
        uom: ctx?.uom ?? '',
        receivedQuantity: ctx?.receivedQuantity ?? returnQty(line.returnQuantity),
        batchNumber: ctx?.batchNumber ?? null,
        lotNumber: ctx?.lotNumber ?? null,
        serialNumber: ctx?.serialNumber ?? null,
        returnQuantity: returnQty(line.returnQuantity),
        rate: returnQty(line.rate),
        amount: returnQty(line.amount),
        hsnCode: line.hsnCodeSnapshot,
        gstGroupCode: line.gstGroupCodeSnapshot,
        gstRatePct: returnQty(line.gstRatePctSnapshot),
        cgstRatePct: returnQty(line.cgstRateSnapshot),
        sgstRatePct: returnQty(line.sgstRateSnapshot),
        igstRatePct: returnQty(line.igstRateSnapshot),
        gstScheme: line.gstSchemeSnapshot,
      }
    }),
  }
}
