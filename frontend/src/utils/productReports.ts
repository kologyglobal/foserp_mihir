import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { PRODUCT_FAMILY_LABELS, PRODUCT_STATUS_LABELS } from '../types/productMaster'
import type { Product } from '../types/master'

export interface ProductRevisionReportRow {
  productId: string
  productCode: string
  productName: string
  productFamily: string
  currentRevision: string
  drawingRevision: string
  bomRevision: string
  routingRevision: string
  status: string
  engineeringOwner: string
  effectiveFrom: string
  effectiveTo: string | null
  revisionCount: number
}

export interface ObsoleteProductRow {
  productId: string
  productCode: string
  productName: string
  effectiveTo: string | null
  engineeringOwner: string
}

export interface ProductCostReportRow {
  productId: string
  productCode: string
  productName: string
  materialCost: number
  laborCost: number
  machineCost: number
  overheadCost: number
  totalCost: number
  listPrice: number
  costOverride: boolean
}

export interface ProductUsageReportRow {
  productId: string
  productCode: string
  productName: string
  status: string
  openSalesOrders: number
  openWorkOrders: number
  totalRevenue: number
}

export interface EngineeringChangeReportRow {
  productCode: string
  productName: string
  field: string
  oldValue: string
  newValue: string
  changedByName: string
  changedAt: string
  reason: string
}

function mapProduct(p: Product): ProductRevisionReportRow {
  return {
    productId: p.id,
    productCode: p.productCode,
    productName: p.productName,
    productFamily: PRODUCT_FAMILY_LABELS[p.productFamily],
    currentRevision: p.productRevision,
    drawingRevision: p.drawingRevision,
    bomRevision: p.bomRevision,
    routingRevision: p.routingRevision,
    status: PRODUCT_STATUS_LABELS[p.status],
    engineeringOwner: p.engineeringOwner,
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    revisionCount: p.revisions.length + 1,
  }
}

export function getProductRevisionReport(): ProductRevisionReportRow[] {
  return useMasterStore.getState().products.map(mapProduct)
}

export function getObsoleteProductReport(): ObsoleteProductRow[] {
  return useMasterStore
    .getState()
    .products.filter((p) => p.status === 'obsolete')
    .map((p) => ({
      productId: p.id,
      productCode: p.productCode,
      productName: p.productName,
      effectiveTo: p.effectiveTo,
      engineeringOwner: p.engineeringOwner,
    }))
}

export function getProductCostReport(): ProductCostReportRow[] {
  return useMasterStore.getState().products.map((p) => ({
    productId: p.id,
    productCode: p.productCode,
    productName: p.productName,
    materialCost: p.standardCost.materialCost,
    laborCost: p.standardCost.laborCost,
    machineCost: p.standardCost.machineCost,
    overheadCost: p.standardCost.overheadCost,
    totalCost: p.standardCost.totalCost,
    listPrice: p.standardPrice,
    costOverride: p.standardCost.costOverride,
  }))
}

export function getProductUsageReport(): ProductUsageReportRow[] {
  const sos = useMrpStore.getState().salesOrders
  const wos = useWorkOrderStore.getState().workOrders
  return useMasterStore.getState().products.map((p) => {
    const productSos = sos.filter((so) => so.productId === p.id && !['closed', 'invoiced'].includes(so.status))
    const productWos = wos.filter((wo) => wo.productId === p.id && !['closed', 'cancelled'].includes(wo.status))
    return {
      productId: p.id,
      productCode: p.productCode,
      productName: p.productName,
      status: PRODUCT_STATUS_LABELS[p.status],
      openSalesOrders: productSos.length,
      openWorkOrders: productWos.length,
      totalRevenue: productSos.reduce((s, so) => s + (so.grandTotal ?? p.standardPrice * so.qty), 0),
    }
  })
}

export function getEngineeringChangeReport(): EngineeringChangeReportRow[] {
  const rows: EngineeringChangeReportRow[] = []
  for (const p of useMasterStore.getState().products) {
    for (const c of p.changeLog) {
      rows.push({
        productCode: p.productCode,
        productName: p.productName,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        changedByName: c.changedByName,
        changedAt: c.changedAt,
        reason: c.reason,
      })
    }
  }
  return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt))
}
