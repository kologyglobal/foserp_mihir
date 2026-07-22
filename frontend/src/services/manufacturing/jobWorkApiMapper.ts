/**
 * Maps Phase 4B Job Work API responses into the demo UI JobWork* shapes.
 */
import type {
  JobWorkDispatch,
  JobWorkInvoiceStatus,
  JobWorkMaterial,
  JobWorkMaterialLineStatus,
  JobWorkOrder,
  JobWorkRateBasis,
  JobWorkReceipt,
  JobWorkReconciliation,
  JobWorkStatus,
} from '../../types/manufacturingJobWork'

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v !== '') return Number(v)
  return 0
}

function lowerStatus(status: string): JobWorkStatus {
  return status.toLowerCase() as JobWorkStatus
}

function lowerRateBasis(basis: string): JobWorkRateBasis {
  return basis.toLowerCase() as JobWorkRateBasis
}

function lowerInvoice(status: string): JobWorkInvoiceStatus {
  return status.toLowerCase() as JobWorkInvoiceStatus
}

function lowerMaterialStatus(status: string): JobWorkMaterialLineStatus {
  return status.toLowerCase() as JobWorkMaterialLineStatus
}

type ApiJobWork = {
  id: string
  jwNumber: string
  status: string
  vendorId: string
  productionOrderId?: string | null
  processName: string
  itemId: string
  orderedQty: string | number
  sentQty: string | number
  receivedQty: string | number
  acceptedQty: string | number
  rejectedQty: string | number
  reworkQty: string | number
  rate: string | number
  rateBasis: string
  expectedCost: string | number
  expectedReturnDate?: string | null
  invoiceStatus: string
  invoiceId?: string | null
  invoiceNo?: string | null
  invoiceAmount?: string | number | null
  materialWarehouseId: string
  receiptWarehouseId: string
  plantId?: string | null
  qualityRequired: boolean
  materialSentAt?: string | null
  vendorChallan?: string | null
  transporter?: string | null
  vehicle?: string | null
  deliveryAddress?: string | null
  drawingRevision?: string | null
  qualityInstructions?: string | null
  remarks?: string | null
  materialToSend?: string | null
  differenceApproved?: boolean
  differenceReason?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  vendor?: { id: string; name: string; address?: string | null }
  item?: { id: string; code: string; name: string }
  materialWarehouse?: { id: string; code: string; name: string }
  receiptWarehouse?: { id: string; code: string; name: string }
  productionOrder?: { id: string; orderNumber: string } | null
  materialLines?: ApiMaterialLine[]
  dispatches?: ApiDispatch[]
  receipts?: ApiReceipt[]
}

type ApiMaterialLine = {
  id: string
  jobWorkOrderId: string
  itemId: string
  requiredQty: string | number
  sentQty: string | number
  additionalSentQty: string | number
  consumedQty: string | number
  returnedQty: string | number
  scrapReturnedQty: string | number
  balanceWithVendor?: string | number
  status: string
  remarks?: string | null
  item?: { code: string; name: string }
}

type ApiDispatch = {
  id: string
  jobWorkOrderId: string
  dispatchedAt: string
  vendorChallan?: string | null
  vehicle?: string | null
  transporter?: string | null
  remarks?: string | null
  createdBy?: string | null
  lines?: Array<{ materialLineId: string; quantity: string | number; batchOrSerial?: string | null }>
}

type ApiReceipt = {
  id: string
  jobWorkOrderId: string
  receivedAt: string
  receivedQty: string | number
  acceptedQty: string | number
  rejectedQty: string | number
  reworkQty: string | number
  scrapReturned?: string | number
  unusedReturned?: string | number
  vendorChallan?: string | null
  batchOrSerial?: string | null
  createdBy?: string | null
}

export function mapApiJobWork(row: ApiJobWork): JobWorkOrder {
  const orderedQty = num(row.orderedQty)
  const receivedQty = num(row.receivedQty)
  const status = lowerStatus(row.status)
  const materialBalance = (row.materialLines ?? []).reduce((s, m) => s + num(m.balanceWithVendor), 0)
  return {
    id: row.id,
    jwNumber: row.jwNumber,
    workOrderId: row.productionOrderId ?? row.productionOrder?.id ?? '',
    workOrderNo: row.productionOrder?.orderNumber ?? '—',
    vendorId: row.vendorId,
    vendorName: row.vendor?.name ?? 'Vendor',
    vendorAddress: row.vendor?.address ?? undefined,
    process: row.processName,
    itemId: row.itemId,
    itemCode: row.item?.code ?? '',
    itemName: row.item?.name ?? '',
    uom: 'NOS',
    orderedQty,
    sentQty: num(row.sentQty),
    receivedQty,
    acceptedQty: num(row.acceptedQty),
    rejectedQty: num(row.rejectedQty),
    reworkQty: num(row.reworkQty),
    pendingQty: Math.max(0, orderedQty - receivedQty),
    materialBalance,
    rate: num(row.rate),
    rateBasis: lowerRateBasis(row.rateBasis),
    expectedCost: num(row.expectedCost),
    expectedReturnDate: row.expectedReturnDate ? String(row.expectedReturnDate).slice(0, 10) : '',
    status,
    invoiceStatus: lowerInvoice(row.invoiceStatus),
    materialSentDate: row.materialSentAt ? String(row.materialSentAt).slice(0, 10) : undefined,
    materialToSend: row.materialToSend ?? undefined,
    remarks: row.remarks ?? undefined,
    plantId: row.plantId ?? '',
    plantName: '',
    materialWarehouseId: row.materialWarehouseId,
    materialWarehouseName: row.materialWarehouse?.name ?? '',
    receiptWarehouseId: row.receiptWarehouseId,
    receiptWarehouseName: row.receiptWarehouse?.name ?? '',
    qualityRequired: row.qualityRequired,
    vendorChallan: row.vendorChallan ?? undefined,
    transporter: row.transporter ?? undefined,
    vehicle: row.vehicle ?? undefined,
    deliveryAddress: row.deliveryAddress ?? undefined,
    drawingRevision: row.drawingRevision ?? undefined,
    qualityInstructions: row.qualityInstructions ?? undefined,
    invoiceId: row.invoiceId ?? undefined,
    invoiceNo: row.invoiceNo ?? undefined,
    invoiceAmount: row.invoiceAmount != null ? num(row.invoiceAmount) : undefined,
    differenceApproved: row.differenceApproved,
    differenceReason: row.differenceReason ?? undefined,
    readOnly: status === 'closed' || status === 'cancelled',
    activity: [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy ?? 'API',
  }
}

export function mapApiMaterial(line: ApiMaterialLine): JobWorkMaterial {
  return {
    id: line.id,
    jobWorkId: line.jobWorkOrderId,
    materialItemId: line.itemId,
    materialCode: line.item?.code ?? '',
    materialName: line.item?.name ?? '',
    requiredQty: num(line.requiredQty),
    availableQty: 0,
    sentQty: num(line.sentQty),
    additionalSentQty: num(line.additionalSentQty),
    consumedQty: num(line.consumedQty),
    returnedQty: num(line.returnedQty),
    scrapReturnedQty: num(line.scrapReturnedQty),
    balanceWithVendor: num(line.balanceWithVendor),
    uom: 'NOS',
    status: lowerMaterialStatus(line.status),
    tracking: 'none',
  }
}

export function mapApiDispatch(d: ApiDispatch): JobWorkDispatch {
  return {
    id: d.id,
    jobWorkId: d.jobWorkOrderId,
    dispatchAt: d.dispatchedAt,
    lines: (d.lines ?? []).map((l) => ({
      materialId: l.materialLineId,
      qty: num(l.quantity),
      batchOrSerial: l.batchOrSerial ?? undefined,
    })),
    vendorChallan: d.vendorChallan ?? undefined,
    vehicle: d.vehicle ?? undefined,
    transporter: d.transporter ?? undefined,
    remarks: d.remarks ?? undefined,
    userName: d.createdBy ?? 'API',
  }
}

export function mapApiReceipt(r: ApiReceipt): JobWorkReceipt {
  return {
    id: r.id,
    jobWorkId: r.jobWorkOrderId,
    receivedAt: r.receivedAt,
    receivedQty: num(r.receivedQty),
    acceptedQty: num(r.acceptedQty),
    rejectedQty: num(r.rejectedQty),
    reworkQty: num(r.reworkQty),
    scrapReturned: r.scrapReturned != null ? num(r.scrapReturned) : undefined,
    unusedReturned: r.unusedReturned != null ? num(r.unusedReturned) : undefined,
    vendorChallan: r.vendorChallan ?? undefined,
    batchOrSerial: r.batchOrSerial ?? undefined,
    userName: r.createdBy ?? 'API',
  }
}

export function buildReconciliationFromApi(order: ApiJobWork): JobWorkReconciliation {
  const lines = (order.materialLines ?? []).map((m) => {
    const sent = num(m.sentQty)
    const additionalSent = num(m.additionalSentQty)
    const consumed = num(m.consumedQty)
    const returned = num(m.returnedQty)
    const scrapReturned = num(m.scrapReturnedQty)
    const actualBalance = num(m.balanceWithVendor)
    const expectedBalance = sent + additionalSent - consumed - returned - scrapReturned
    const difference = actualBalance - expectedBalance
    return {
      materialId: m.id,
      materialCode: m.item?.code ?? '',
      sent,
      additionalSent,
      consumed,
      returned,
      scrapReturned,
      processLoss: 0,
      expectedBalance,
      actualBalance,
      difference,
      status: (Math.abs(difference) > 0.01
        ? 'difference'
        : actualBalance > 0
          ? 'material_with_vendor'
          : 'reconciled') as JobWorkReconciliation['lines'][0]['status'],
    }
  })
  const unexplained = lines.reduce((s, l) => s + Math.abs(l.difference) + Math.max(0, l.actualBalance), 0)
  const approved = Boolean(order.differenceApproved)
  return {
    jobWorkId: order.id,
    lines,
    unexplainedDifference: unexplained,
    canClose: unexplained <= 0.01 || approved,
    warnings: unexplained > 0 && !approved ? ['Unexplained material balance with vendor'] : [],
  }
}

export type { ApiJobWork }
