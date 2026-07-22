/**
 * One-shot: patch schema.prisma for models/fields that exist in migrations but
 * were never mirrored into Prisma schema (causes ~400+ tsc errors).
 *
 * Run: node scripts/sync-schema-drift.mjs
 * Then: npx prisma generate
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = resolve(root, 'prisma/schema.prisma')
let schema = readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n')

const MARKER = '// ─── Schema drift sync (migrations 2026-07-22+) ───────────────────────────'

if (schema.includes(MARKER)) {
  console.log('Schema drift block already present — skipping append')
  process.exit(0)
}

function mustReplace(label, from, to) {
  const fromN = from.replace(/\r\n/g, '\n')
  const toN = to.replace(/\r\n/g, '\n')
  if (!schema.includes(fromN)) {
    throw new Error(`Patch failed (${label}): expected text not found`)
  }
  schema = schema.replace(fromN, toN)
  console.log(`Applied: ${label}`)
}

function softReplace(label, from, to) {
  const fromN = from.replace(/\r\n/g, '\n')
  const toN = to.replace(/\r\n/g, '\n')
  if (!schema.includes(fromN)) {
    console.warn(`Soft skip (${label}): expected text not found`)
    return false
  }
  schema = schema.replace(fromN, toN)
  console.log(`Applied: ${label}`)
  return true
}

// ── Enum patches ─────────────────────────────────────────────────────────────
mustReplace(
  'ManufacturingLabourRateSource',
  `enum ManufacturingLabourRateSource {
  WORK_CENTRE_RATE
  TENANT_DEFAULT
}`,
  `enum ManufacturingLabourRateSource {
  WORK_CENTRE_RATE
  TENANT_DEFAULT
  LABOUR_RATE_CARD
}`,
)

mustReplace(
  'ManufacturingOverheadMethod',
  `enum ManufacturingOverheadMethod {
  NONE
  PER_LABOUR_HOUR
  PER_MACHINE_HOUR
  PER_GOOD_UNIT
  PERCENT_OF_MATERIAL_COST
}`,
  `enum ManufacturingOverheadMethod {
  NONE
  PER_LABOUR_HOUR
  PER_MACHINE_HOUR
  PER_GOOD_UNIT
  PERCENT_OF_MATERIAL_COST
  ACTIVITY_BASED
}`,
)

mustReplace(
  'ManufacturingCostingMethod',
  `enum ManufacturingCostingMethod {
  ACTUAL
  PLANNED_AS_PROVISIONAL
}`,
  `enum ManufacturingCostingMethod {
  ACTUAL
  PLANNED_AS_PROVISIONAL
  STANDARD_WITH_VARIANCE
}`,
)

mustReplace(
  'SalesInvoiceSourceType',
  `enum SalesInvoiceSourceType {
  DIRECT
  SALES_ORDER
}`,
  `enum SalesInvoiceSourceType {
  DIRECT
  SALES_ORDER
  OUTBOUND_DISPATCH
}`,
)

// ── Field patches on existing models ─────────────────────────────────────────
mustReplace(
  'PurchaseInvoice AP handoff fields',
  `  goodsReceiptId        String?
  status                PurchaseInvoiceStatus @default(DRAFT)`,
  `  goodsReceiptId        String?
  vendorInvoiceId       String?               @db.VarChar(36)
  vendorInvoiceDraftRef String?               @db.VarChar(64)
  status                PurchaseInvoiceStatus @default(DRAFT)`,
)

if (!schema.includes('purchase_invoices_tenantId_vendorInvoiceId_idx')) {
  mustReplace(
    'PurchaseInvoice vendorInvoice index',
    `  @@index([tenantId, goodsReceiptId])
  @@index([tenantId, invoiceDate])
  @@map("purchase_invoices")
}`,
    `  @@index([tenantId, goodsReceiptId])
  @@index([tenantId, invoiceDate])
  @@index([tenantId, vendorInvoiceId])
  @@map("purchase_invoices")
}`,
  )
}

mustReplace(
  'GoodsReceiptLine inventoryLotId',
  `  serialNumber               String?   @db.VarChar(100)
  manufacturingDate          DateTime? @db.Date
  expiryDate                 DateTime? @db.Date
  qcRequired                 Boolean   @default(false)
  remarks                    String?   @db.Text
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt

  tenant            Tenant            @relation(fields: [tenantId], references: [id])`,
  `  serialNumber               String?   @db.VarChar(100)
  manufacturingDate          DateTime? @db.Date
  expiryDate                 DateTime? @db.Date
  inventoryLotId             String?
  qcRequired                 Boolean   @default(false)
  remarks                    String?   @db.Text
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt

  tenant            Tenant            @relation(fields: [tenantId], references: [id])
  inventoryLot      InventoryLot?     @relation(fields: [inventoryLotId], references: [id])`,
)

// ProductionFinishedGoodsReceipt — add inventoryLotId before closing relations if missing
if (!schema.includes('inventoryLotId') || !schema.match(/model ProductionFinishedGoodsReceipt[\s\S]*?inventoryLotId/)) {
  const fg = schema.match(/model ProductionFinishedGoodsReceipt \{[\s\S]*?\n\}/)
  if (!fg) throw new Error('ProductionFinishedGoodsReceipt not found')
  if (!fg[0].includes('inventoryLotId')) {
    schema = schema.replace(
      fg[0],
      fg[0]
        .replace(
          /remarks\s+String\?\s+@db\.Text\n/,
          (m) => `${m}  inventoryLotId             String?\n`,
        )
        .replace(
          /(tenant\s+Tenant\s+@relation\([^\n]+\n)/,
          `$1  inventoryLot              InventoryLot? @relation(fields: [inventoryLotId], references: [id])\n`,
        )
        .replace(
          /@@index\(\[tenantId, deletedAt\]\)\n/,
          `@@index([tenantId, deletedAt])\n  @@index([tenantId, inventoryLotId], map: "prod_fg_rcp_tenant_lot_idx")\n`,
        ),
    )
    console.log('Applied: ProductionFinishedGoodsReceipt inventoryLotId')
  }
}

// DispatchTrackingAllocation
{
  const block = schema.match(/model DispatchTrackingAllocation \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('inventoryLotId')) {
    schema = schema.replace(
      block[0],
      block[0]
        .replace(
          /createdAt\s+DateTime\s+@default\(now\(\)\)\n/,
          `inventoryLotId    String?\n  inventorySerialId String?\n  createdAt         DateTime @default(now())\n`,
        )
        .replace(
          /(tenant\s+Tenant\s+@relation\([^\n]+\n)/,
          `$1  inventoryLot    InventoryLot?    @relation(fields: [inventoryLotId], references: [id])\n  inventorySerial InventorySerial? @relation(fields: [inventorySerialId], references: [id])\n`,
        ),
    )
    console.log('Applied: DispatchTrackingAllocation lot/serial')
  }
}

// ProductionOrder split fields
{
  const block = schema.match(/model ProductionOrder \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('splitFromOrderId')) {
    schema = schema.replace(
      block[0],
      block[0]
        .replace(
          /deletedAt\s+DateTime\?\n/,
          `splitFromOrderId String?\n  splitSequence    Int?\n  deletedAt        DateTime?\n`,
        )
        .replace(
          /(tenant\s+Tenant\s+@relation\([^\n]+\n)/,
          `$1  splitFromOrder ProductionOrder?  @relation("ProductionOrderSplits", fields: [splitFromOrderId], references: [id])\n  splitChildren  ProductionOrder[] @relation("ProductionOrderSplits")\n  splitAsParent  ProductionOrderSplit[] @relation("ProductionOrderSplitParent")\n  splitAsChild   ProductionOrderSplit?  @relation("ProductionOrderSplitChild")\n`,
        )
        .replace(
          /@@index\(\[tenantId, deletedAt\]\)\n/,
          `@@index([tenantId, deletedAt])\n  @@index([tenantId, splitFromOrderId])\n`,
        ),
    )
    console.log('Applied: ProductionOrder split fields')
  }
}

// SalesInvoice project + sourceLinks
{
  const block = schema.match(/model SalesInvoice \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('projectNameSnapshot')) {
    schema = schema.replace(
      block[0],
      block[0]
        .replace(
          /sourceDocumentSnapshot Json\?\n/,
          `sourceDocumentSnapshot Json?\n\n  projectRef          String? @db.VarChar(100)\n  projectNameSnapshot String? @db.VarChar(200)\n`,
        )
        .replace(
          /(lines\s+SalesInvoiceLine\[\])/,
          `$1\n  sourceLinks SalesInvoiceSourceLink[]\n  arDisputes  ArDispute[]`,
        ),
    )
    console.log('Applied: SalesInvoice project + links')
  }
}

// SalesInvoiceLine project
{
  const block = schema.match(/model SalesInvoiceLine \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('projectNameSnapshot')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /createdAt\s+DateTime\s+@default\(now\(\)\)\n/,
        `projectRef          String?  @db.VarChar(100)\n  projectNameSnapshot String?  @db.VarChar(200)\n  createdAt           DateTime @default(now())\n`,
      ).replace(
        /(salesInvoice\s+SalesInvoice\s+@relation\([^\n]+\n)/,
        `$1  sourceLinks SalesInvoiceSourceLink[]\n`,
      ),
    )
    console.log('Applied: SalesInvoiceLine project')
  }
}

// CrmSalesOrder project
{
  const block = schema.match(/model CrmSalesOrder \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('projectNameSnapshot')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /deletedAt\s+DateTime\?\n/,
        `projectRef          String?   @db.VarChar(100)\n  projectNameSnapshot String?   @db.VarChar(200)\n  deletedAt           DateTime?\n`,
      ),
    )
    console.log('Applied: CrmSalesOrder project')
  }
}

// MasterItem batch/serial tracking
{
  const block = schema.match(/model MasterItem \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('batchTracked')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /status\s+MasterRecordStatus\s+@default\(ACTIVE\)\n/,
        `batchTracked  Boolean            @default(false)\n  serialTracked Boolean            @default(false)\n  status        MasterRecordStatus @default(ACTIVE)\n`,
      ),
    )
    console.log('Applied: MasterItem batch/serialTracked')
  }
}

// InventoryStockMovement relations for batch/serial
{
  const block = schema.match(/model InventoryStockMovement \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('batch InventoryBatch')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /reservation InventoryStockReservation\? @relation\(fields: \[reservationId\], references: \[id\]\)\n/,
        `reservation     InventoryStockReservation? @relation(fields: [reservationId], references: [id])
  batch           InventoryBatch?             @relation(fields: [batchId], references: [id])
  serial          InventorySerial?            @relation(fields: [serialId], references: [id])
  serialMovements InventorySerialMovement[]
  lotMovements    InventoryLotMovement[]
`,
      ),
    )
    console.log('Applied: InventoryStockMovement batch/serial relations')
  }
}

// Tenant relation arrays
mustReplace(
  'Tenant inventory/gate/dispute relations',
  `  inventoryStockBalances            InventoryStockBalance[]
  inventoryStockMovements           InventoryStockMovement[]
  inventoryStockReservations        InventoryStockReservation[]`,
  `  inventoryStockBalances            InventoryStockBalance[]
  inventoryStockMovements           InventoryStockMovement[]
  inventoryStockReservations        InventoryStockReservation[]
  inventoryTransfers                InventoryTransfer[]
  inventoryTransferLines            InventoryTransferLine[]
  inventoryStockCounts              InventoryStockCount[]
  inventoryStockCountLines          InventoryStockCountLine[]
  inventoryAdjustments              InventoryAdjustment[]
  inventoryAdjustmentLines          InventoryAdjustmentLine[]
  inventoryBatches                  InventoryBatch[]
  inventoryBatchBalances            InventoryBatchBalance[]
  inventorySerials                  InventorySerial[]
  inventorySerialMovements          InventorySerialMovement[]
  inventoryLots                     InventoryLot[]
  inventoryLotMovements             InventoryLotMovement[]
  inventoryAccountingEvents         InventoryAccountingEvent[]
  apDisputes                        ApDispute[]
  arDisputes                        ArDispute[]
  salesInvoiceSourceLinks           SalesInvoiceSourceLink[]
  labourRateCards                   LabourRateCard[]
  overheadCostPools                 OverheadCostPool[]
  manufacturingSettings             ManufacturingSettings?
  productionOrderSplits             ProductionOrderSplit[]
  gateSettings                      GateSettings?
  gateLocations                     GateLocation[]
  gateVisitorProfiles               GateVisitorProfile[]
  gateVisitorVisits                 GateVisitorVisit[]
  gateExpectedVisitors              GateExpectedVisitor[]
  gateVehicles                      GateVehicle[]
  gateMaterialInwards               GateMaterialInward[]
  gateMaterialOutwards              GateMaterialOutward[]
  gatePasses                        GatePass[]
  gatePassItems                     GatePassItem[]
  gateContractorEntries             GateContractorEntry[]
  gateCourierEntries                GateCourierEntry[]
  gateApprovals                     GateApproval[]
  gateActivities                    GateActivity[]`,
)

// MasterWarehouse relations
mustReplace(
  'MasterWarehouse inventory doc relations',
  `  inventoryStockBalances          InventoryStockBalance[]
  inventoryStockMovements         InventoryStockMovement[]
  inventoryStockReservations      InventoryStockReservation[]`,
  `  inventoryStockBalances          InventoryStockBalance[]
  inventoryStockMovements         InventoryStockMovement[]
  inventoryStockReservations      InventoryStockReservation[]
  inventoryTransfersFrom          InventoryTransfer[]      @relation("InventoryTransferFromWarehouse")
  inventoryTransfersTo            InventoryTransfer[]      @relation("InventoryTransferToWarehouse")
  inventoryStockCounts            InventoryStockCount[]
  inventoryAdjustments            InventoryAdjustment[]
  inventoryBatchBalances          InventoryBatchBalance[]
  inventorySerials                InventorySerial[]
  inventorySerialMovements        InventorySerialMovement[]
  inventoryLots                   InventoryLot[]`,
)

// VendorInvoice reverse for ApDispute
{
  const block = schema.match(/model VendorInvoice \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('apDisputes')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /(lines\s+VendorInvoiceLine\[\])/,
        `$1\n  apDisputes ApDispute[]`,
      ),
    )
    console.log('Applied: VendorInvoice apDisputes')
  }
}

// LegalEntity relations for disputes / source links / accounting events
{
  const block = schema.match(/model LegalEntity \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('apDisputes')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /(tenant\s+Tenant\s+@relation\([^\n]+\n)/,
        `$1  apDisputes              ApDispute[]\n  arDisputes              ArDispute[]\n  salesInvoiceSourceLinks SalesInvoiceSourceLink[]\n  inventoryAccountingEvents InventoryAccountingEvent[]\n`,
      ),
    )
    console.log('Applied: LegalEntity dispute/source relations')
  }
}

// PayableOpenItem / ReceivableOpenItem optional reverse
{
  const pay = schema.match(/model PayableOpenItem \{[\s\S]*?\n\}/)
  if (pay && !pay[0].includes('apDisputes')) {
    schema = schema.replace(
      pay[0],
      pay[0].replace(/(tenant\s+Tenant\s+@relation\([^\n]+\n)/, `$1  apDisputes ApDispute[]\n`),
    )
    console.log('Applied: PayableOpenItem apDisputes')
  }
  const rec = schema.match(/model ReceivableOpenItem \{[\s\S]*?\n\}/)
  if (rec && !rec[0].includes('arDisputes')) {
    schema = schema.replace(
      rec[0],
      rec[0].replace(/(tenant\s+Tenant\s+@relation\([^\n]+\n)/, `$1  arDisputes ArDispute[]\n`),
    )
    console.log('Applied: ReceivableOpenItem arDisputes')
  }
}

const FRAGMENT = `
${MARKER}

enum InventoryTransferStatus {
  DRAFT
  SUBMITTED
  APPROVED
  IN_TRANSIT
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
  REVERSED
}

enum InventoryStockCountStatus {
  DRAFT
  SNAPSHOTTED
  COUNTING
  SUBMITTED
  APPROVED
  POSTED
  REVERSED
}

enum InventoryAdjustmentStatus {
  DRAFT
  SUBMITTED
  APPROVED
  POSTED
  REVERSED
}

enum InventoryBatchStatus {
  ACTIVE
  BLOCKED
  EXPIRED
  CLOSED
}

enum InventorySerialStatus {
  AVAILABLE
  RESERVED
  QC_HOLD
  BLOCKED
  REJECTED
  ISSUED
  SCRAPPED
  RETURNED
}

enum InventoryLotStatus {
  ACTIVE
  QUARANTINE
  EXPIRED
  CONSUMED
  CANCELLED
}

enum InventoryAccountingEventType {
  GRN_INWARD
  GRN_REVERSAL
  PURCHASE_RETURN
  STOCK_ADJUSTMENT
  STOCK_ADJUSTMENT_REVERSAL
  STOCK_COUNT_ADJUSTMENT
  STOCK_COUNT_REVERSAL
  FG_DISPATCH
  FG_DISPATCH_REVERSAL
}

enum InventoryAccountingEventStatus {
  RECORDED
  POSTED
  SKIPPED_ZERO
  SKIPPED_FLAG_OFF
  SKIPPED_NO_LEGAL_ENTITY
  FAILED
  REVERSED
}

enum ApDisputeType {
  PRICE_DIFFERENCE
  QUANTITY_DIFFERENCE
  QUALITY_ISSUE
  DELIVERY_DELAY
  SHORT_SUPPLY
  TAX_ISSUE
  MISSING_DOCUMENT
  DUPLICATE_INVOICE
  COMMERCIAL_TERMS
  OTHER
}

enum ApDisputePriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ApDisputeStatus {
  OPEN
  UNDER_REVIEW
  AWAITING_VENDOR
  AWAITING_INTERNAL_TEAM
  RESOLVED
  REJECTED
  CLOSED
}

enum ArDisputeType {
  PRICE_DIFFERENCE
  QUANTITY_DIFFERENCE
  QUALITY_ISSUE
  DELIVERY_DELAY
  SHORT_SUPPLY
  TAX_ISSUE
  MISSING_DOCUMENT
  DUPLICATE_INVOICE
  COMMERCIAL_TERMS
  OTHER
}

enum ArDisputePriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ArDisputeStatus {
  OPEN
  UNDER_REVIEW
  AWAITING_CUSTOMER
  AWAITING_INTERNAL_TEAM
  RESOLVED
  REJECTED
  CLOSED
}

enum SalesInvoiceSourceLinkType {
  SALES_ORDER
  OUTBOUND_DISPATCH
  DELIVERY_CHALLAN
}

enum SalesInvoiceSourceLinkStatus {
  ACTIVE
  RELEASED
}

model InventoryTransfer {
  id               String                  @id @default(uuid())
  tenantId         String
  transferNumber   String                  @db.VarChar(64)
  status           InventoryTransferStatus @default(DRAFT)
  fromWarehouseId  String
  toWarehouseId    String
  transferDate     DateTime                @db.Date
  remarks          String?                 @db.Text
  submittedAt      DateTime?
  submittedBy      String?
  approvedAt       DateTime?
  approvedBy       String?
  dispatchedAt     DateTime?
  dispatchedBy     String?
  receivedAt       DateTime?
  receivedBy       String?
  cancelledAt      DateTime?
  cancelledBy      String?
  reversedAt       DateTime?
  reversedBy       String?
  reversalReason   String?                 @db.Text
  createdBy        String?
  updatedBy        String?
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  tenant        Tenant                   @relation(fields: [tenantId], references: [id])
  fromWarehouse MasterWarehouse          @relation("InventoryTransferFromWarehouse", fields: [fromWarehouseId], references: [id])
  toWarehouse   MasterWarehouse          @relation("InventoryTransferToWarehouse", fields: [toWarehouseId], references: [id])
  lines         InventoryTransferLine[]

  @@unique([tenantId, transferNumber])
  @@index([tenantId, status])
  @@index([tenantId, fromWarehouseId])
  @@index([tenantId, toWarehouseId])
  @@map("inventory_transfers")
}

model InventoryTransferLine {
  id                   String   @id @default(uuid())
  tenantId             String
  transferId           String
  itemId               String
  quantity             Decimal  @db.Decimal(18, 4)
  dispatchedQty        Decimal  @default(0) @db.Decimal(18, 4)
  receivedQty          Decimal  @default(0) @db.Decimal(18, 4)
  rate                 Decimal  @default(0) @db.Decimal(18, 2)
  remarks              String?  @db.Text
  batchId              String?
  serialId             String?
  batchNumberSnapshot  String?  @db.VarChar(64)
  serialNumberSnapshot String?  @db.VarChar(100)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  tenant  Tenant            @relation(fields: [tenantId], references: [id])
  transfer InventoryTransfer @relation(fields: [transferId], references: [id])
  item    MasterItem        @relation(fields: [itemId], references: [id])
  batch   InventoryBatch?   @relation(fields: [batchId], references: [id])
  serial  InventorySerial?  @relation(fields: [serialId], references: [id])

  @@unique([transferId, itemId])
  @@index([tenantId, itemId])
  @@index([tenantId, batchId])
  @@index([tenantId, serialId])
  @@map("inventory_transfer_lines")
}

model InventoryStockCount {
  id             String                     @id @default(uuid())
  tenantId       String
  countNumber    String                     @db.VarChar(64)
  warehouseId    String
  status         InventoryStockCountStatus  @default(DRAFT)
  countDate      DateTime                   @db.Date
  remarks        String?                    @db.Text
  snapshotAt     DateTime?
  submittedAt    DateTime?
  submittedBy    String?
  approvedAt     DateTime?
  approvedBy     String?
  postedAt       DateTime?
  postedBy       String?
  reversedAt     DateTime?
  reversedBy     String?
  reversalReason String?                    @db.Text
  createdBy      String?
  updatedBy      String?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  tenant    Tenant                     @relation(fields: [tenantId], references: [id])
  warehouse MasterWarehouse            @relation(fields: [warehouseId], references: [id])
  lines     InventoryStockCountLine[]

  @@unique([tenantId, countNumber])
  @@index([tenantId, status])
  @@index([tenantId, warehouseId])
  @@map("inventory_stock_counts")
}

model InventoryStockCountLine {
  id           String   @id @default(uuid())
  tenantId     String
  stockCountId String
  itemId       String
  systemQty    Decimal  @db.Decimal(18, 4)
  countedQty   Decimal? @db.Decimal(18, 4)
  varianceQty  Decimal? @db.Decimal(18, 4)
  rate         Decimal  @default(0) @db.Decimal(18, 2)
  remarks      String?  @db.Text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant     Tenant              @relation(fields: [tenantId], references: [id])
  stockCount InventoryStockCount @relation(fields: [stockCountId], references: [id])
  item       MasterItem          @relation(fields: [itemId], references: [id])

  @@unique([stockCountId, itemId])
  @@index([tenantId, itemId])
  @@map("inventory_stock_count_lines")
}

model InventoryAdjustment {
  id               String                    @id @default(uuid())
  tenantId         String
  adjustmentNumber String                    @db.VarChar(64)
  warehouseId      String
  status           InventoryAdjustmentStatus @default(DRAFT)
  adjustmentDate   DateTime                  @db.Date
  reason           String                    @db.VarChar(500)
  remarks          String?                   @db.Text
  submittedAt      DateTime?
  submittedBy      String?
  approvedAt       DateTime?
  approvedBy       String?
  postedAt         DateTime?
  postedBy         String?
  reversedAt       DateTime?
  reversedBy       String?
  reversalReason   String?                   @db.Text
  createdBy        String?
  updatedBy        String?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt

  tenant    Tenant                     @relation(fields: [tenantId], references: [id])
  warehouse MasterWarehouse            @relation(fields: [warehouseId], references: [id])
  lines     InventoryAdjustmentLine[]

  @@unique([tenantId, adjustmentNumber])
  @@index([tenantId, status])
  @@index([tenantId, warehouseId])
  @@map("inventory_adjustments")
}

model InventoryAdjustmentLine {
  id           String   @id @default(uuid())
  tenantId     String
  adjustmentId String
  itemId       String
  quantity     Decimal  @db.Decimal(18, 4)
  rate         Decimal  @default(0) @db.Decimal(18, 2)
  reason       String?  @db.VarChar(500)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant     Tenant              @relation(fields: [tenantId], references: [id])
  adjustment InventoryAdjustment @relation(fields: [adjustmentId], references: [id])
  item       MasterItem          @relation(fields: [itemId], references: [id])

  @@unique([adjustmentId, itemId])
  @@index([tenantId, itemId])
  @@map("inventory_adjustment_lines")
}

model InventoryBatch {
  id                  String               @id @default(uuid())
  tenantId            String
  itemId              String
  batchNumber         String               @db.VarChar(64)
  lotNumber           String?              @db.VarChar(64)
  heatNumber          String?              @db.VarChar(64)
  manufacturingDate   DateTime?            @db.Date
  expiryDate          DateTime?            @db.Date
  supplierBatchNumber String?              @db.VarChar(64)
  status              InventoryBatchStatus @default(ACTIVE)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  tenant     Tenant                  @relation(fields: [tenantId], references: [id])
  item       MasterItem              @relation(fields: [itemId], references: [id])
  balances   InventoryBatchBalance[]
  serials    InventorySerial[]
  movements  InventoryStockMovement[]
  transferLines InventoryTransferLine[]

  @@unique([tenantId, itemId, batchNumber])
  @@index([tenantId, status])
  @@index([tenantId, expiryDate])
  @@map("inventory_batches")
}

model InventoryBatchBalance {
  id          String               @id @default(uuid())
  tenantId    String
  batchId     String
  itemId      String
  warehouseId String
  stockStatus InventoryStockStatus @default(UNRESTRICTED)
  quantity    Decimal              @default(0) @db.Decimal(18, 4)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  batch     InventoryBatch  @relation(fields: [batchId], references: [id])
  item      MasterItem      @relation(fields: [itemId], references: [id])
  warehouse MasterWarehouse @relation(fields: [warehouseId], references: [id])

  @@unique([tenantId, batchId, warehouseId, stockStatus], map: "inventory_batch_balances_tenant_batch_wh_status_key")
  @@index([tenantId, itemId, warehouseId])
  @@map("inventory_batch_balances")
}

model InventorySerial {
  id                  String                 @id @default(uuid())
  tenantId            String
  itemId              String
  serialNumber        String                 @db.VarChar(100)
  batchId             String?
  lotId               String?
  warehouseId         String?
  stockStatus         InventoryStockStatus   @default(UNRESTRICTED)
  status              InventorySerialStatus  @default(AVAILABLE)
  sourceReferenceType InventoryReferenceType?
  sourceReferenceNo   String?                @db.VarChar(100)
  createdBy           String?
  updatedBy           String?
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
  deletedAt           DateTime?

  tenant                    Tenant                         @relation(fields: [tenantId], references: [id])
  item                      MasterItem                     @relation(fields: [itemId], references: [id])
  batch                     InventoryBatch?                @relation(fields: [batchId], references: [id])
  lot                       InventoryLot?                  @relation(fields: [lotId], references: [id])
  warehouse                 MasterWarehouse?               @relation(fields: [warehouseId], references: [id])
  movements                 InventoryStockMovement[]
  serialMovements           InventorySerialMovement[]
  transferLines             InventoryTransferLine[]
  dispatchTrackingAllocations DispatchTrackingAllocation[]

  @@unique([tenantId, itemId, serialNumber])
  @@index([tenantId, serialNumber])
  @@index([tenantId, itemId, warehouseId, stockStatus])
  @@index([tenantId, lotId])
  @@index([tenantId, deletedAt])
  @@map("inventory_serials")
}

model InventorySerialMovement {
  id              String                @id @default(uuid())
  tenantId        String
  serialId        String
  movementId      String
  warehouseId     String
  fromStockStatus InventoryStockStatus?
  stockStatus     InventoryStockStatus
  quantity        Decimal               @db.Decimal(18, 4)
  createdAt       DateTime              @default(now())

  tenant    Tenant                 @relation(fields: [tenantId], references: [id])
  serial    InventorySerial        @relation(fields: [serialId], references: [id])
  movement  InventoryStockMovement @relation(fields: [movementId], references: [id])
  warehouse MasterWarehouse        @relation(fields: [warehouseId], references: [id])

  @@unique([tenantId, serialId, movementId])
  @@index([tenantId, movementId])
  @@index([tenantId, serialId, createdAt])
  @@map("inventory_serial_movements")
}

model InventoryLot {
  id                  String             @id @default(uuid())
  tenantId            String
  itemId              String
  warehouseId         String?
  lotNumber           String             @db.VarChar(100)
  heatNumber          String?            @db.VarChar(100)
  quantityOnHand      Decimal            @default(0) @db.Decimal(18, 4)
  status              InventoryLotStatus @default(ACTIVE)
  manufacturedAt      DateTime?          @db.Date
  expiryDate          DateTime?          @db.Date
  receivedAt          DateTime?
  sourceReferenceType String?            @db.VarChar(64)
  sourceReferenceId   String?
  createdBy           String?
  updatedBy           String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  deletedAt           DateTime?

  tenant                      Tenant                         @relation(fields: [tenantId], references: [id])
  item                        MasterItem                     @relation(fields: [itemId], references: [id])
  warehouse                   MasterWarehouse?               @relation(fields: [warehouseId], references: [id])
  serials                     InventorySerial[]
  lotMovements                InventoryLotMovement[]
  goodsReceiptLines           GoodsReceiptLine[]
  productionFinishedGoodsReceipts ProductionFinishedGoodsReceipt[]
  dispatchTrackingAllocations DispatchTrackingAllocation[]

  @@unique([tenantId, itemId, lotNumber])
  @@index([tenantId, warehouseId, status])
  @@index([tenantId, deletedAt])
  @@map("inventory_lots")
}

model InventoryLotMovement {
  id              String   @id @default(uuid())
  tenantId        String
  lotId           String
  stockMovementId String
  quantity        Decimal  @db.Decimal(18, 4)
  createdAt       DateTime @default(now())

  tenant        Tenant                 @relation(fields: [tenantId], references: [id])
  lot           InventoryLot           @relation(fields: [lotId], references: [id])
  stockMovement InventoryStockMovement @relation(fields: [stockMovementId], references: [id])

  @@unique([stockMovementId, lotId])
  @@index([tenantId, lotId])
  @@map("inventory_lot_movements")
}

model InventoryAccountingEvent {
  id                 String                          @id @default(uuid())
  tenantId           String
  legalEntityId      String?
  eventType          InventoryAccountingEventType
  status             InventoryAccountingEventStatus  @default(RECORDED)
  movementId         String?
  idempotencyKey     String                          @db.VarChar(150)
  sourceDocumentType String                          @db.VarChar(64)
  sourceDocumentId   String
  quantity           Decimal                         @db.Decimal(18, 4)
  amount             Decimal                         @default(0) @db.Decimal(18, 4)
  currencyCode       String                          @default("INR") @db.VarChar(8)
  payloadJson        Json?
  voucherId          String?
  postingEventId     String?
  postedAt           DateTime?
  failureReason      String?                         @db.Text
  createdBy          String?
  createdAt          DateTime                        @default(now())
  updatedAt          DateTime                        @updatedAt

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity? @relation(fields: [legalEntityId], references: [id])

  @@unique([tenantId, idempotencyKey], map: "inv_acct_evt_tenant_idem_key")
  @@index([tenantId], map: "inv_acct_evt_tenant_idx")
  @@index([tenantId, eventType], map: "inv_acct_evt_tenant_type_idx")
  @@index([tenantId, status], map: "inv_acct_evt_tenant_status_idx")
  @@index([tenantId, movementId], map: "inv_acct_evt_tenant_mov_idx")
  @@index([tenantId, legalEntityId], map: "inv_acct_evt_tenant_le_idx")
  @@map("inventory_accounting_events")
}

model ApDispute {
  id                            String           @id @default(uuid())
  tenantId                      String
  legalEntityId                 String
  disputeNumber                 String           @db.VarChar(64)
  vendorId                      String
  vendorCodeSnapshot            String           @db.VarChar(32)
  vendorNameSnapshot            String           @db.VarChar(300)
  vendorInvoiceId               String
  payableOpenItemId             String?
  vendorInvoiceNumberSnapshot   String           @db.VarChar(64)
  supplierInvoiceNumberSnapshot String           @db.VarChar(128)
  disputeDate                   DateTime         @db.Date
  disputeType                   ApDisputeType
  disputedAmount                Decimal          @db.Decimal(18, 4)
  description                   String           @db.Text
  ownerName                     String           @db.VarChar(200)
  responsibleDepartment         String           @db.VarChar(120)
  priority                      ApDisputePriority @default(MEDIUM)
  targetResolutionDate          DateTime?        @db.Date
  status                        ApDisputeStatus  @default(OPEN)
  resolution                    String?          @db.Text
  debitNoteRequired             Boolean          @default(false)
  paymentHold                   Boolean          @default(false)
  supportingDocuments           Json?
  createdBy                     String?
  updatedBy                     String?
  createdAt                     DateTime         @default(now())
  updatedAt                     DateTime         @updatedAt
  deletedAt                     DateTime?

  tenant          Tenant           @relation(fields: [tenantId], references: [id])
  legalEntity     LegalEntity      @relation(fields: [legalEntityId], references: [id])
  vendorInvoice   VendorInvoice    @relation(fields: [vendorInvoiceId], references: [id])
  payableOpenItem PayableOpenItem? @relation(fields: [payableOpenItemId], references: [id])

  @@unique([tenantId, legalEntityId, disputeNumber], map: "ap_dispute_le_number_key")
  @@index([tenantId])
  @@index([tenantId, legalEntityId])
  @@index([tenantId, legalEntityId, status])
  @@index([tenantId, vendorId])
  @@index([tenantId, vendorInvoiceId])
  @@index([tenantId, payableOpenItemId])
  @@index([tenantId, deletedAt])
  @@map("ap_disputes")
}

model ArDispute {
  id                    String            @id @default(uuid())
  tenantId              String
  legalEntityId         String
  disputeNumber         String            @db.VarChar(64)
  customerId            String
  customerNameSnapshot   String            @db.VarChar(300)
  salesInvoiceId        String
  openItemId            String?
  invoiceNumberSnapshot String            @db.VarChar(64)
  disputeDate           DateTime          @db.Date
  disputeType           ArDisputeType
  disputedAmount        Decimal           @db.Decimal(18, 4)
  description           String            @db.Text
  ownerName             String            @db.VarChar(200)
  responsibleDepartment String            @db.VarChar(120)
  priority              ArDisputePriority @default(MEDIUM)
  targetResolutionDate  DateTime?         @db.Date
  status                ArDisputeStatus   @default(OPEN)
  resolution            String?           @db.Text
  creditNoteRequired    Boolean           @default(false)
  collectionHold        Boolean           @default(false)
  supportingDocuments   Json?
  createdBy             String?
  updatedBy             String?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  deletedAt             DateTime?

  tenant       Tenant              @relation(fields: [tenantId], references: [id])
  legalEntity  LegalEntity         @relation(fields: [legalEntityId], references: [id])
  salesInvoice SalesInvoice        @relation(fields: [salesInvoiceId], references: [id])
  openItem     ReceivableOpenItem? @relation(fields: [openItemId], references: [id])

  @@unique([tenantId, legalEntityId, disputeNumber], map: "ar_dispute_le_number_key")
  @@index([tenantId])
  @@index([tenantId, legalEntityId])
  @@index([tenantId, legalEntityId, status])
  @@index([tenantId, customerId])
  @@index([tenantId, salesInvoiceId])
  @@index([tenantId, openItemId])
  @@index([tenantId, deletedAt])
  @@map("ar_disputes")
}

model SalesInvoiceSourceLink {
  id                           String                       @id @default(uuid())
  tenantId                     String
  legalEntityId                String
  salesInvoiceId               String
  salesInvoiceLineId           String?
  sourceType                   SalesInvoiceSourceLinkType
  sourceDocumentId             String
  sourceLineId                 String?                      @db.VarChar(64)
  salesOrderId                 String?
  salesOrderLineId             String?                      @db.VarChar(64)
  deliveryChallanId            String?
  deliveryChallanLineId        String?
  quantity                     Decimal                      @db.Decimal(18, 6)
  status                       SalesInvoiceSourceLinkStatus @default(ACTIVE)
  sourceDocumentNumberSnapshot String?                      @db.VarChar(64)
  itemId                       String?
  itemCodeSnapshot             String?                      @db.VarChar(64)
  itemNameSnapshot             String?                      @db.VarChar(300)
  metadata                     Json?
  createdAt                    DateTime                     @default(now())
  updatedAt                    DateTime                     @updatedAt

  tenant           Tenant            @relation(fields: [tenantId], references: [id])
  legalEntity      LegalEntity       @relation(fields: [legalEntityId], references: [id])
  salesInvoice     SalesInvoice      @relation(fields: [salesInvoiceId], references: [id], onDelete: Cascade)
  salesInvoiceLine SalesInvoiceLine? @relation(fields: [salesInvoiceLineId], references: [id])

  @@index([tenantId])
  @@index([legalEntityId])
  @@index([salesInvoiceId])
  @@index([salesInvoiceLineId])
  @@index([status, sourceType, sourceDocumentId, sourceLineId], map: "si_src_link_consume_idx")
  @@index([tenantId, salesOrderId, salesOrderLineId], map: "si_src_link_so_line_idx")
  @@index([tenantId, sourceType, sourceDocumentId], map: "si_src_link_doc_idx")
  @@map("sales_invoice_source_links")
}

model LabourRateCard {
  id             String    @id @default(uuid())
  tenantId       String
  code           String    @db.VarChar(64)
  name           String    @db.VarChar(200)
  workCentreId   String?
  roleCode       String?   @db.VarChar(64)
  operatorUserId String?
  ratePerHour    Decimal   @db.Decimal(18, 2)
  currencyCode   String    @default("INR") @db.VarChar(8)
  effectiveFrom  DateTime  @db.Date
  effectiveTo    DateTime? @db.Date
  isActive       Boolean   @default(true)
  createdBy      String?
  updatedBy      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  tenant     Tenant                   @relation(fields: [tenantId], references: [id])
  workCentre ManufacturingWorkCentre? @relation(fields: [workCentreId], references: [id])

  @@unique([tenantId, code])
  @@index([tenantId, workCentreId, effectiveFrom])
  @@map("labour_rate_cards")
}

model OverheadCostPool {
  id           String    @id @default(uuid())
  tenantId     String
  code         String    @db.VarChar(64)
  name         String    @db.VarChar(200)
  plantCode    String?   @db.VarChar(32)
  driverType   String    @db.VarChar(32)
  periodAmount Decimal   @db.Decimal(18, 2)
  periodStart  DateTime  @db.Date
  periodEnd    DateTime  @db.Date
  isActive     Boolean   @default(true)
  createdBy    String?
  updatedBy    String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, code, periodStart])
  @@index([tenantId, plantCode, periodStart, periodEnd])
  @@map("overhead_cost_pools")
}

model ManufacturingSettings {
  id                               String   @id @default(uuid())
  tenantId                         String   @unique
  version                          Int      @default(1)
  payloadJson                      Json
  allowOverproduction              Boolean  @default(true)
  overproductionTolerancePercent   Decimal  @default(5) @db.Decimal(9, 4)
  allowCloseWithoutQc              Boolean  @default(false)
  requireReservation               Boolean  @default(false)
  allowPartialProduction           Boolean  @default(true)
  allowProductionWithoutFullMaterial Boolean @default(true)
  autoPostAbsorption               Boolean  @default(false)
  oeeEnabled                       Boolean  @default(false)
  shiftMinutesPerDay               Int      @default(480)
  createdBy                        String?
  updatedBy                        String?
  createdAt                        DateTime @default(now())
  updatedAt                        DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("manufacturing_settings")
}

model ProductionOrderSplit {
  id            String   @id @default(uuid())
  tenantId      String
  parentOrderId String
  childOrderId  String   @unique
  splitQty      Decimal  @db.Decimal(18, 4)
  reason        String?  @db.Text
  createdBy     String?
  createdAt     DateTime @default(now())

  tenant      Tenant          @relation(fields: [tenantId], references: [id])
  parentOrder ProductionOrder @relation("ProductionOrderSplitParent", fields: [parentOrderId], references: [id])
  childOrder  ProductionOrder @relation("ProductionOrderSplitChild", fields: [childOrderId], references: [id])

  @@index([tenantId, parentOrderId])
  @@index([tenantId, childOrderId])
  @@map("production_order_splits")
}

model GateSettings {
  id          String   @id @default(uuid())
  tenantId    String   @unique
  payloadJson Json
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("gate_settings")
}

model GateLocation {
  id                String    @id @default(uuid())
  tenantId          String
  name              String    @db.VarChar(120)
  plant             String    @db.VarChar(120)
  entryTypesAllowed Json
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, isActive])
  @@map("gate_locations")
}

model GateVisitorProfile {
  id                String    @id @default(uuid())
  tenantId          String
  name              String    @db.VarChar(200)
  mobile            String    @db.VarChar(30)
  company           String?   @db.VarChar(200)
  email             String?   @db.VarChar(255)
  photoUrl          String?   @db.VarChar(500)
  idType            String?   @db.VarChar(64)
  idReferenceMasked String?   @db.VarChar(64)
  lastHost          String?   @db.VarChar(200)
  lastVehicleNumber String?   @db.VarChar(40)
  lastVisitAt       DateTime?
  totalVisits       Int       @default(0)
  isBlacklisted     Boolean   @default(false)
  blacklistReason   String?   @db.VarChar(500)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  tenant Tenant             @relation(fields: [tenantId], references: [id])
  visits GateVisitorVisit[]

  @@unique([tenantId, mobile])
  @@index([tenantId, isBlacklisted])
  @@map("gate_visitor_profiles")
}

model GateVisitorVisit {
  id                        String    @id @default(uuid())
  tenantId                  String
  entryNumber               String    @db.VarChar(40)
  status                    String    @db.VarChar(32)
  visitorProfileId          String?
  visitorName               String    @db.VarChar(200)
  mobile                    String    @db.VarChar(30)
  company                   String?   @db.VarChar(200)
  email                     String?   @db.VarChar(255)
  visitorType               String    @db.VarChar(40)
  visitorCount              Int       @default(1)
  photoUrl                  String?   @db.VarChar(500)
  idType                    String?   @db.VarChar(64)
  idReferenceMasked         String?   @db.VarChar(64)
  hostName                  String    @db.VarChar(200)
  department                String    @db.VarChar(120)
  purpose                   String    @db.VarChar(300)
  expectedDurationMinutes   Int?
  meetingLocation           String?   @db.VarChar(200)
  remarks                   String?   @db.Text
  vehicleNumber             String?   @db.VarChar(40)
  vehicleType               String?   @db.VarChar(64)
  laptopCarried             Boolean   @default(false)
  equipmentCarried          Boolean   @default(false)
  bagCount                  Int       @default(0)
  belongingsDescription     String?   @db.Text
  safetyDeclarationAccepted Boolean   @default(false)
  ppeRequired               Boolean   @default(false)
  ndaRequired               Boolean   @default(false)
  hostApprovalRequired      Boolean   @default(false)
  approvalStatus            String    @default("not_required") @db.VarChar(32)
  approvalRemarks           String?   @db.Text
  approvedBy                String?   @db.VarChar(200)
  approvedAt                DateTime?
  gate                      String    @db.VarChar(120)
  visitDate                 String    @db.VarChar(10)
  expectedArrival           String    @db.VarChar(64)
  entryTime                 DateTime?
  exitTime                  DateTime?
  exitRemarks               String?   @db.Text
  badgeReturned             Boolean?
  instructions              String?   @db.Text
  approvalHistoryJson       Json
  createdBy                 String    @db.VarChar(200)
  updatedBy                 String    @db.VarChar(200)
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  deletedAt                 DateTime?

  tenant         Tenant              @relation(fields: [tenantId], references: [id])
  visitorProfile GateVisitorProfile? @relation(fields: [visitorProfileId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@index([tenantId, visitDate])
  @@index([tenantId, mobile])
  @@map("gate_visitor_visits")
}

model GateExpectedVisitor {
  id              String    @id @default(uuid())
  tenantId        String
  reference       String    @db.VarChar(40)
  visitorName     String    @db.VarChar(200)
  mobile          String    @db.VarChar(30)
  company         String?   @db.VarChar(200)
  visitDate       String    @db.VarChar(10)
  expectedArrival String    @db.VarChar(64)
  hostName        String    @db.VarChar(200)
  department      String    @db.VarChar(120)
  purpose         String    @db.VarChar(300)
  gate            String    @db.VarChar(120)
  vehicleNumber   String?   @db.VarChar(40)
  instructions    String?   @db.Text
  status          String    @db.VarChar(32)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, reference])
  @@index([tenantId, visitDate, status])
  @@map("gate_expected_visitors")
}

model GateVehicle {
  id               String    @id @default(uuid())
  tenantId         String
  entryNumber      String    @db.VarChar(40)
  status           String    @db.VarChar(32)
  vehicleNumber    String    @db.VarChar(40)
  vehicleType      String    @db.VarChar(64)
  purpose          String    @db.VarChar(300)
  companyName      String?   @db.VarChar(200)
  transporter      String?   @db.VarChar(200)
  driverName       String    @db.VarChar(200)
  driverMobile     String?   @db.VarChar(30)
  licenceVerified  String    @default("not_checked") @db.VarChar(32)
  relatedDocument  String?   @db.VarChar(120)
  gate             String    @db.VarChar(120)
  plannedLocation  String?   @db.VarChar(200)
  currentLocation  String?   @db.VarChar(200)
  sealNumber       String?   @db.VarChar(64)
  remarks          String?   @db.Text
  entryTime        DateTime?
  exitTime         DateTime?
  exitRemarks      String?   @db.Text
  timelineJson     Json
  createdBy        String    @db.VarChar(200)
  updatedBy        String    @db.VarChar(200)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@index([tenantId, vehicleNumber])
  @@map("gate_vehicles")
}

model GateMaterialInward {
  id                String    @id @default(uuid())
  tenantId          String
  entryNumber       String    @db.VarChar(40)
  status            String    @db.VarChar(32)
  inwardType        String    @db.VarChar(40)
  vendorName        String?   @db.VarChar(200)
  poNumber          String?   @db.VarChar(80)
  challanNumber     String?   @db.VarChar(80)
  invoiceNumber     String?   @db.VarChar(80)
  lrNumber          String?   @db.VarChar(80)
  vehicleNumber     String?   @db.VarChar(40)
  vehicleType       String?   @db.VarChar(64)
  transporter       String?   @db.VarChar(200)
  driverName        String?   @db.VarChar(200)
  driverMobile      String?   @db.VarChar(30)
  sealNumber        String?   @db.VarChar(64)
  materialSummary   String    @db.VarChar(500)
  packages          Int       @default(0)
  approxQty         Float?
  uom               String?   @db.VarChar(32)
  grossWeight       String?   @db.VarChar(64)
  warehouse         String?   @db.VarChar(120)
  unloadingLocation String?   @db.VarChar(200)
  documentPhotoUrl  String?   @db.VarChar(500)
  materialPhotoUrl  String?   @db.VarChar(500)
  remarks           String?   @db.Text
  gate              String    @db.VarChar(120)
  arrivalTime       DateTime?
  linesJson         Json
  linkedGrnNumber   String?   @db.VarChar(80)
  linkedQcNumber    String?   @db.VarChar(80)
  timelineJson      Json
  createdBy         String    @db.VarChar(200)
  updatedBy         String    @db.VarChar(200)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@map("gate_material_inwards")
}

model GateMaterialOutward {
  id                String    @id @default(uuid())
  tenantId          String
  entryNumber       String    @db.VarChar(40)
  status            String    @db.VarChar(32)
  outwardType       String    @db.VarChar(40)
  documentType      String    @db.VarChar(80)
  documentNumber    String    @db.VarChar(80)
  documentApproved  Boolean   @default(false)
  partyName         String?   @db.VarChar(200)
  vehicleNumber     String?   @db.VarChar(40)
  driverName        String?   @db.VarChar(200)
  driverMobile      String?   @db.VarChar(30)
  transporter       String?   @db.VarChar(200)
  sealNumber        String?   @db.VarChar(64)
  materialSummary   String    @db.VarChar(500)
  packagesExpected  Int       @default(0)
  packagesVerified  Int?
  approvalStatus    String    @default("not_required") @db.VarChar(32)
  plannedTime       DateTime?
  releasedAt        DateTime?
  releasedBy        String?   @db.VarChar(200)
  holdRemarks       String?   @db.Text
  mismatchRemarks   String?   @db.Text
  rejectRemarks     String?   @db.Text
  checklistJson     Json
  gate              String    @db.VarChar(120)
  linesJson         Json
  timelineJson      Json
  createdBy         String    @db.VarChar(200)
  updatedBy         String    @db.VarChar(200)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@map("gate_material_outwards")
}

model GatePass {
  id                  String    @id @default(uuid())
  tenantId            String
  entryNumber         String    @db.VarChar(40)
  status              String    @db.VarChar(32)
  passKind            String    @db.VarChar(32)
  movementType        String    @db.VarChar(80)
  department          String    @db.VarChar(120)
  responsibleEmployee String    @db.VarChar(200)
  carriedBy           String    @db.VarChar(200)
  partyName           String?   @db.VarChar(200)
  purpose             String    @db.VarChar(300)
  outwardDate         DateTime
  expectedReturnDate  DateTime?
  approverName        String?   @db.VarChar(200)
  approvalStatus      String    @default("pending") @db.VarChar(32)
  approvalRemarks     String?   @db.Text
  returnsJson         Json
  gate                String    @db.VarChar(120)
  createdBy           String    @db.VarChar(200)
  updatedBy           String    @db.VarChar(200)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  deletedAt           DateTime?

  tenant Tenant         @relation(fields: [tenantId], references: [id])
  items  GatePassItem[]

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@map("gate_passes")
}

model GatePassItem {
  id               String  @id @default(uuid())
  tenantId         String
  gatePassId       String
  itemDescription  String  @db.VarChar(500)
  serialNumber     String? @db.VarChar(120)
  quantity         Float
  uom              String  @db.VarChar(32)
  conditionOut     String? @db.VarChar(200)
  returnedQuantity Float   @default(0)
  remarks          String? @db.Text

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  gatePass GatePass @relation(fields: [gatePassId], references: [id], onDelete: Cascade)

  @@index([tenantId, gatePassId])
  @@map("gate_pass_items")
}

model GateContractorEntry {
  id                  String    @id @default(uuid())
  tenantId            String
  entryNumber         String    @db.VarChar(40)
  status              String    @db.VarChar(32)
  workerName          String    @db.VarChar(200)
  mobile              String    @db.VarChar(30)
  contractorCompany   String    @db.VarChar(200)
  workReference       String?   @db.VarChar(120)
  department          String    @db.VarChar(120)
  supervisor          String    @db.VarChar(200)
  workLocation        String    @db.VarChar(200)
  validFrom           String    @db.VarChar(10)
  validUntil          String    @db.VarChar(10)
  safetyInductionDone Boolean   @default(false)
  ppeIssued           Boolean   @default(false)
  toolsCarried        String?   @db.Text
  photoUrl            String?   @db.VarChar(500)
  purpose             String    @db.VarChar(300)
  remarks             String?   @db.Text
  gate                String    @db.VarChar(120)
  entryTime           DateTime?
  exitTime            DateTime?
  createdBy           String    @db.VarChar(200)
  updatedBy           String    @db.VarChar(200)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  deletedAt           DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@map("gate_contractor_entries")
}

model GateCourierEntry {
  id                String    @id @default(uuid())
  tenantId          String
  entryNumber       String    @db.VarChar(40)
  status            String    @db.VarChar(32)
  direction         String    @db.VarChar(16)
  courierCompany    String    @db.VarChar(120)
  trackingNumber    String?   @db.VarChar(80)
  senderName        String?   @db.VarChar(200)
  recipientEmployee String?   @db.VarChar(200)
  department        String?   @db.VarChar(120)
  parcelType        String?   @db.VarChar(80)
  parcelDescription String?   @db.Text
  receivedTime      DateTime?
  receivedBy        String?   @db.VarChar(200)
  handoverTime      DateTime?
  handedOverTo      String?   @db.VarChar(200)
  dispatchTime      DateTime?
  charges           Float?
  remarks           String?   @db.Text
  gate              String    @db.VarChar(120)
  createdBy         String    @db.VarChar(200)
  updatedBy         String    @db.VarChar(200)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entryNumber])
  @@index([tenantId, status])
  @@map("gate_courier_entries")
}

model GateApproval {
  id            String    @id @default(uuid())
  tenantId      String
  requestNumber String    @db.VarChar(40)
  requestType   String    @db.VarChar(40)
  requestedBy   String    @db.VarChar(200)
  subject       String    @db.VarChar(500)
  reason        String    @db.Text
  requestedAt   DateTime  @default(now())
  priority      String    @default("normal") @db.VarChar(16)
  status        String    @db.VarChar(32)
  sourceType    String    @db.VarChar(40)
  sourceId      String
  actionedBy    String?   @db.VarChar(200)
  actionedAt    DateTime?
  actionRemarks String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, requestNumber])
  @@index([tenantId, status])
  @@index([tenantId, sourceType, sourceId])
  @@map("gate_approvals")
}

model GateActivity {
  id          String   @id @default(uuid())
  tenantId    String
  time        DateTime @default(now())
  event       String   @db.VarChar(40)
  recordType  String   @db.VarChar(40)
  recordId    String
  recordLabel String   @db.VarChar(500)
  company     String?  @db.VarChar(200)
  gate        String   @db.VarChar(120)
  operator    String   @db.VarChar(200)
  status      String   @db.VarChar(32)

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, time])
  @@map("gate_activities")
}
`

// MasterItem reverse relations for new inventory models
{
  const block = schema.match(/model MasterItem \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('inventoryBatches')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /inventoryStockReservations\s+InventoryStockReservation\[\]\n/,
        `inventoryStockReservations InventoryStockReservation[]
  inventoryBatches            InventoryBatch[]
  inventoryBatchBalances      InventoryBatchBalance[]
  inventorySerials            InventorySerial[]
  inventoryLots               InventoryLot[]
  inventoryTransferLines      InventoryTransferLine[]
  inventoryStockCountLines    InventoryStockCountLine[]
  inventoryAdjustmentLines    InventoryAdjustmentLine[]
`,
      ),
    )
    console.log('Applied: MasterItem inventory reverse relations')
  }
}

// ManufacturingWorkCentre labourRateCards
{
  const block = schema.match(/model ManufacturingWorkCentre \{[\s\S]*?\n\}/)
  if (block && !block[0].includes('labourRateCards')) {
    schema = schema.replace(
      block[0],
      block[0].replace(
        /(tenant\s+Tenant\s+@relation\([^\n]+\n)/,
        `$1  labourRateCards LabourRateCard[]\n`,
      ),
    )
    console.log('Applied: ManufacturingWorkCentre labourRateCards')
  }
}

schema = schema.trimEnd() + '\n' + FRAGMENT + '\n'
writeFileSync(schemaPath, schema, 'utf8')
console.log('Wrote schema drift sync block to', schemaPath)
