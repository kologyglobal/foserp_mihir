/**
 * Diagnose PurchaseOrder P2022 — prints Prisma error with missing column/table.
 * Usage: npx tsx scripts/diagnose-po-p2022.ts
 */
import { createPrismaClient } from '../src/config/prisma.js'

const prisma = createPrismaClient()

const EXPECTED: Record<string, string[]> = {
  purchase_orders: [
    'id', 'tenantId', 'orderNumber', 'orderDate', 'vendorId', 'origin', 'status',
    'purchaseRequisitionId', 'requestForQuotationId', 'vendorQuotationId', 'vendorComparisonId',
    'currencyCode', 'expectedDeliveryDate', 'paymentTerms', 'deliveryTerms', 'deliveryWarehouseId',
    'subtotalAmount', 'taxAmount', 'freightAmount', 'totalAmount', 'remarks', 'revisionNo',
    'submittedAt', 'approvedAt', 'rejectedAt', 'rejectionReason', 'sentBackAt', 'sendBackReason',
    'sentAt', 'closedAt', 'cancelledAt', 'createdById', 'updatedById', 'createdAt', 'updatedAt', 'deletedAt',
  ],
  purchase_order_lines: [
    'id', 'tenantId', 'purchaseOrderId', 'lineNumber', 'purchaseRequisitionLineId', 'purchasePlanningRowId',
    'itemId', 'itemCodeSnapshot', 'itemNameSnapshot', 'description', 'quantity', 'uomQuantity',
    'uomConversionFactor', 'unitCostPrimary', 'uomId', 'rate', 'amount', 'receivedQuantity',
    'acceptedQuantity', 'rejectedQuantity', 'returnedQuantity', 'invoicedQuantity',
    'gstGroupId', 'hsnId', 'hsnCodeSnapshot', 'gstGroupCodeSnapshot', 'binId', 'qcRequiredSnapshot',
    'qualityTestGroupCodeSnapshot', 'requiredDate', 'requisitionNumber', 'remarks', 'createdAt', 'updatedAt',
  ],
}

async function missingColumns() {
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('purchase_orders', 'purchase_order_lines')
  `
  const have = new Set(rows.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`))
  const missing: string[] = []
  for (const [table, cols] of Object.entries(EXPECTED)) {
    for (const col of cols) {
      if (!have.has(`${table}.${col}`)) missing.push(`${table}.${col}`)
    }
  }
  return missing
}

async function main() {
  console.log('DB:', process.env.DB_NAME ?? '(from DATABASE_URL)')
  const missing = await missingColumns()
  if (missing.length) {
    console.log('\nMISSING COLUMNS:')
    missing.forEach((m) => console.log(' -', m))
  } else {
    console.log('\nAll expected purchase_orders / purchase_order_lines columns present.')
  }

  const tables = await prisma.$queryRaw<Array<{ t: string }>>`
    SELECT TABLE_NAME AS t FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('purchase_order_revisions','purchase_order_archived','master_bins')
  `
  console.log('\nRelated tables:', tables.map((x) => x.t).join(', ') || '(none)')

  try {
    await prisma.purchaseOrder.findMany({
      take: 1,
      include: {
        lines: { include: { bin: true, uom: true, gstGroup: true, hsn: true } },
        vendor: true,
        deliveryWarehouse: true,
        purchaseRequisition: { include: { warehouse: true } },
        requestForQuotation: true,
        revisions: { take: 1 },
      },
    })
    console.log('\nPrisma PO query: OK')
  } catch (e) {
    console.log('\nPrisma PO query FAILED:')
    console.log(e)
  }

  await prisma.$disconnect()
}

void main()
