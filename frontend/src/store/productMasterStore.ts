import { create } from 'zustand'
import type { Product } from '../types/master'
import type { ProductAttachmentCategory, ProductStatus } from '../types/productMaster'
import { PRODUCT_STATUS_FLOW } from '../types/productMaster'
import { useBomStore } from './bomStore'
import { useCostingStore } from './costingStore'
import { useMasterStore } from './masterStore'
import { useMrpStore } from './mrpStore'
import { useRoutingStore } from './routingStore'
import { useWorkOrderStore } from './workOrderStore'
import { getReleasedRoutingForProduct } from '../utils/routing'
import {
  appendChangeLog,
  assertProductSellableForSales,
  createInitialRevision,
  deriveCostsFromBomAndRouting,
  makeAttachment,
} from '../utils/productMaster'
import { getSessionUser } from '../utils/permissions'
import {
  advanceApprovalStep,
  assertMatrixApproval,
  buildApprovalContext,
  syncApprovalRequest,
} from '../utils/approvalEngine'

type ActionResult = { ok: boolean; error?: string }

interface ProductMasterActions {
  updateProductWithLog: (productId: string, patch: Partial<Product>, reason: string) => ActionResult
  advanceProductStatus: (productId: string, toStatus: ProductStatus, reason?: string) => ActionResult
  releaseProduct: (productId: string) => ActionResult
  obsoleteProduct: (productId: string, reason: string) => ActionResult
  createProductRevision: (
    productId: string,
    input: {
      revisionNo: string
      drawingRevision?: string
      bomRevision?: string
      routingRevision?: string
      revisionReason: string
      engineeringOwner?: string
    },
  ) => ActionResult
  deriveProductCosts: (productId: string) => ActionResult
  approveCostOverride: (productId: string) => ActionResult
  setCostOverride: (productId: string, costs: Partial<Product['standardCost']>, reason: string) => ActionResult
  addProductAttachment: (productId: string, name: string, category: ProductAttachmentCategory) => ActionResult
  canUseProductInSales: (productId: string) => ActionResult
  validateProductRelease: (productId: string) => ActionResult
  syncManufacturingLinks: (productId: string) => ActionResult
}

function patchProduct(productId: string, updater: (p: Product) => Product) {
  const product = useMasterStore.getState().getProduct(productId)
  if (!product) return null
  const next = updater(product)
  useMasterStore.getState().updateProduct(productId, next)
  return next
}

function fieldSnapshot(product: Product, key: string): unknown {
  return (product as unknown as Record<string, unknown>)[key]
}

function openSalesOrdersForProduct(productId: string) {
  return useMrpStore.getState().salesOrders.filter(
    (so) => so.productId === productId && !['closed', 'invoiced'].includes(so.status),
  )
}

function openWorkOrdersForProduct(productId: string) {
  return useWorkOrderStore.getState().workOrders.filter(
    (wo) => wo.productId === productId && !['closed', 'cancelled'].includes(wo.status),
  )
}

function validateProductReleaseImpl(productId: string): ActionResult {
  const product = useMasterStore.getState().getProduct(productId)
  if (!product) return { ok: false, error: 'Product not found' }
  if (!product.fgItemId) return { ok: false, error: 'FG Item link required' }
  const bom = useBomStore.getState().getReleasedBomForProduct(productId)
  if (!bom) return { ok: false, error: 'Released BOM required' }
  const routing = getReleasedRoutingForProduct(useRoutingStore.getState().routingHeaders, productId)
  if (!routing) return { ok: false, error: 'Released Routing required' }
  if (product.status !== 'approved') return { ok: false, error: 'Product must be Approved before release' }
  return { ok: true }
}

function syncManufacturingLinksImpl(productId: string): ActionResult {
  const bom = useBomStore.getState().getReleasedBomForProduct(productId)
  const routing = getReleasedRoutingForProduct(useRoutingStore.getState().routingHeaders, productId)
  const ops = routing ? useRoutingStore.getState().getOperations(routing.id) : []
  const wcIds = [...new Set(ops.map((o) => o.workCenterId))]

  patchProduct(productId, (p) => ({
    ...p,
    bomRevision: bom?.revision ?? p.bomRevision,
    routingRevision: routing?.revision ?? p.routingRevision,
    manufacturing: {
      ...p.manufacturing,
      releasedBomHeaderId: bom?.id ?? null,
      releasedRoutingHeaderId: routing?.id ?? null,
      standardLaborHours: routing?.totalStdHours ?? p.manufacturing.standardLaborHours,
      defaultWorkCenterIds: wcIds,
    },
  }))
  return { ok: true }
}

function updateProductWithLogImpl(productId: string, patch: Partial<Product>, reason: string): ActionResult {
  const product = useMasterStore.getState().getProduct(productId)
  if (!product) return { ok: false, error: 'Product not found' }
  if (product.status === 'obsolete') return { ok: false, error: 'Obsolete product is locked' }

  const logs = Object.entries(patch)
    .filter(([key, val]) => JSON.stringify(fieldSnapshot(product, key)) !== JSON.stringify(val))
    .map(([field, val]) => ({
      field,
      oldValue: String(fieldSnapshot(product, field) ?? ''),
      newValue: String(val ?? ''),
      reason,
    }))

  patchProduct(productId, (p) => ({
    ...p,
    ...patch,
    changeLog: logs.length ? appendChangeLog(p, logs) : p.changeLog,
  }))
  return { ok: true }
}

function releaseProductImpl(productId: string): ActionResult {
  const check = validateProductReleaseImpl(productId)
  if (!check.ok) return check
  syncManufacturingLinksImpl(productId)
  return updateProductWithLogImpl(productId, { status: 'released' }, 'Product released to manufacturing')
}

function obsoleteProductImpl(productId: string, reason: string): ActionResult {
  if (openSalesOrdersForProduct(productId).length > 0) {
    return { ok: false, error: 'Cannot obsolete — open sales orders exist' }
  }
  if (openWorkOrdersForProduct(productId).length > 0) {
    return { ok: false, error: 'Cannot obsolete — open work orders exist' }
  }
  if (!useMasterStore.getState().getProduct(productId)) {
    return { ok: false, error: 'Product not found' }
  }

  patchProduct(productId, (p) => ({
    ...p,
    status: 'obsolete',
    isActive: false,
    effectiveTo: new Date().toISOString().slice(0, 10),
    revisions: p.revisions.map((r) => ({ ...r, locked: true })),
    changeLog: appendChangeLog(p, [{ field: 'status', oldValue: p.status, newValue: 'obsolete', reason }]),
  }))
  return { ok: true }
}

const productMasterActions: ProductMasterActions = {
  updateProductWithLog: updateProductWithLogImpl,
  validateProductRelease: validateProductReleaseImpl,
  syncManufacturingLinks: syncManufacturingLinksImpl,
  releaseProduct: releaseProductImpl,
  obsoleteProduct: obsoleteProductImpl,

  advanceProductStatus: (productId, toStatus, reason) => {
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) return { ok: false, error: 'Product not found' }
    if (!PRODUCT_STATUS_FLOW[product.status]?.includes(toStatus)) {
      return { ok: false, error: `Cannot move from ${product.status} to ${toStatus}` }
    }
    if (toStatus === 'released') return releaseProductImpl(productId)
    if (toStatus === 'obsolete') return obsoleteProductImpl(productId, reason ?? 'Marked obsolete')
    return updateProductWithLogImpl(productId, { status: toStatus }, reason ?? `Status → ${toStatus}`)
  },

  createProductRevision: (productId, input) => {
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) return { ok: false, error: 'Product not found' }
    if (product.status === 'obsolete') return { ok: false, error: 'Obsolete product cannot be revised' }

    const prev = createInitialRevision(product)
    patchProduct(productId, (p) => ({
      ...p,
      productRevision: input.revisionNo,
      drawingRevision: input.drawingRevision ?? p.drawingRevision,
      bomRevision: input.bomRevision ?? p.bomRevision,
      routingRevision: input.routingRevision ?? p.routingRevision,
      revisionReason: input.revisionReason,
      engineeringOwner: input.engineeringOwner ?? p.engineeringOwner,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      status: p.status === 'released' ? 'engineering_review' : p.status,
      revisions: [prev, ...p.revisions.map((r) => ({ ...r, locked: true }))],
      changeLog: appendChangeLog(p, [{
        field: 'productRevision',
        oldValue: p.productRevision,
        newValue: input.revisionNo,
        reason: input.revisionReason,
      }]),
    }))
    return { ok: true }
  },

  deriveProductCosts: (productId) => {
    const bom = useBomStore.getState().getReleasedBomForProduct(productId)
    const routing = getReleasedRoutingForProduct(useRoutingStore.getState().routingHeaders, productId)
    if (!bom || !routing) return { ok: false, error: 'Released BOM and Routing required for cost derivation' }
    const standardCost = deriveCostsFromBomAndRouting({
      bomTotalCost: bom.totalCost,
      routingStdHours: routing.totalStdHours,
      overheadPct: useCostingStore.getState().overheadPct,
    })
    return updateProductWithLogImpl(productId, { standardCost }, 'Costs derived from BOM and Routing')
  },

  approveCostOverride: (productId) => {
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) return { ok: false, error: 'Product not found' }
    if (!product.standardCost.costOverride) return { ok: false, error: 'No cost override pending' }
    const user = getSessionUser()
    const matrixCheck = assertMatrixApproval('cost_override', productId, user)
    if (!matrixCheck.ok) return matrixCheck

    const advance = advanceApprovalStep('cost_override', productId, user)
    if (!advance.ok) return advance
    if (!advance.completed) {
      return { ok: true, pendingNextApprover: advance.nextApprover }
    }

    return updateProductWithLogImpl(
      productId,
      { standardCost: { ...product.standardCost, overrideApprovedBy: user.name, overrideApprovedAt: new Date().toISOString() } },
      'Cost override approved',
    )
  },

  setCostOverride: (productId, costs, reason) => {
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) return { ok: false, error: 'Product not found' }
    const merged = { ...product.standardCost, ...costs, costOverride: true, overrideApprovedBy: null, overrideApprovedAt: null }
    merged.totalCost = merged.materialCost + merged.laborCost + merged.machineCost + merged.overheadCost
    const result = updateProductWithLogImpl(productId, { standardCost: merged }, reason)
    if (result.ok) {
      syncApprovalRequest({
        documentType: 'cost_override',
        entityId: productId,
        entityLabel: product.productCode,
        context: buildApprovalContext('cost_override', { ...product, standardCost: merged }),
        submittedByName: getSessionUser().name,
      })
    }
    return result
  },

  addProductAttachment: (productId, name, category) => {
    if (!useMasterStore.getState().getProduct(productId)) return { ok: false, error: 'Product not found' }
    const att = makeAttachment(name, category)
    patchProduct(productId, (p) => ({
      ...p,
      attachments: [...p.attachments, att],
      changeLog: appendChangeLog(p, [{ field: 'attachment', oldValue: '—', newValue: name, reason: `Added ${category}` }]),
    }))
    return { ok: true }
  },

  canUseProductInSales: (productId) => {
    const product = useMasterStore.getState().getProduct(productId)
    const check = assertProductSellableForSales(product)
    if (!check.ok) return check
    return { ok: true }
  },
}

export const useProductMasterStore = create<ProductMasterActions>(() => productMasterActions)
