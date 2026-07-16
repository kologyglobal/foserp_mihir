import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BomHeader, BomLine, BomLineEnriched, BomStatus } from '../types/bom'
import type { Item } from '../types/master'
import {
  buildBomTree,
  computeBomTotalCost,
  flattenBomTree,
  hasDuplicateSiblingItem,
  hasInactiveItems,
  inferIssueWarehouseId,
  inferNodeLevel,
  inferSourceType,
  nextRevision,
} from '../utils/bom'
import { isMrpEligibleStatus, getReleasedBomForProduct } from '../utils/mrp'
import { getNextCode } from '../services/codeSeriesService'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { mergeBomWithSeed, type BomPersistSlice } from '../utils/persistMigration'
import { getSessionUser } from '../utils/permissions'
import { assertBomReleaseDocuments } from '../utils/dmsRules'
import {
  advanceApprovalStep,
  assertMatrixApproval,
  buildApprovalContext,
  syncApprovalRequest,
} from '../utils/approvalEngine'
import { getMasterStoreState, registerBomStore } from './storeBridge'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function recalcHeaderCost(
  header: BomHeader,
  lines: BomLine[],
  items: Item[],
  getUomCode: (id: string) => string,
  getWarehouseCode: (id: string) => string,
): number {
  const tree = buildBomTree(
    header,
    lines.filter((l) => l.bomHeaderId === header.id),
    items,
    getUomCode,
    getWarehouseCode,
  )
  return computeBomTotalCost(tree)
}

interface BomState {
  bomHeaders: BomHeader[]
  bomLines: BomLine[]

  getBom: (id: string) => BomHeader | undefined
  getBomsByProduct: (productId: string) => BomHeader[]
  getLines: (bomHeaderId: string) => BomLine[]
  getBomTree: (bomHeaderId: string) => BomLineEnriched[]
  getFlatLines: (bomHeaderId: string) => BomLineEnriched[]
  isMrpEligible: (bomHeaderId: string) => boolean
  getReleasedBomForProduct: (productId: string) => BomHeader | undefined

  createBom: (productId: string, description: string, bomNo?: string) => string
  updateBomHeader: (id: string, data: Partial<BomHeader>) => void
  addBomLine: (
    bomHeaderId: string,
    parentLineId: string | null,
    itemId: string,
    qtyPerParent: number,
    scrapPct?: number,
    sourceType?: BomLine['sourceType'],
  ) => { ok: boolean; error?: string; lineId?: string }
  updateBomLine: (lineId: string, data: Partial<Pick<BomLine, 'qtyPerParent' | 'scrapPct' | 'sourceType' | 'leadTimeDays'>>) => { ok: boolean; error?: string }
  removeBomLine: (lineId: string) => void

  cloneBom: (bomHeaderId: string) => string
  reviseBom: (bomHeaderId: string) => string
  submitForApproval: (bomHeaderId: string) => { ok: boolean; error?: string }
  approveBom: (bomHeaderId: string, approvedBy: string) => { ok: boolean; error?: string; pendingNextApprover?: string }
  releaseBom: (bomHeaderId: string) => void

  refreshCosts: (bomHeaderId: string) => void
}

function getMasterContext() {
  const s = getMasterStoreState()
  if (!s) {
    return {
      items: [] as Item[],
      categories: [] as { id: string; defaultWarehouseId?: string | null }[],
      getUomCode: (_id: string) => '—',
      getWarehouseCode: (_id: string) => '—',
      getCategoryDefaultWh: (_catId: string) => null as string | null,
      getItem: (_id: string) => undefined as Item | undefined,
      getVendorMapsForItem: (_itemId: string) => [] as { vendorId: string }[],
    }
  }
  return {
    items: s.items,
    categories: s.categories,
    getUomCode: (id: string) => s.uoms.find((u) => u.id === id)?.uomCode ?? '—',
    getWarehouseCode: (id: string) => s.warehouses.find((w) => w.id === id)?.warehouseCode ?? '—',
    getCategoryDefaultWh: (catId: string) =>
      s.categories.find((c) => c.id === catId)?.defaultWarehouseId ?? null,
    getItem: s.getItem,
    getVendorMapsForItem: s.getVendorMapsForItem,
  }
}

export const useBomStore = create<BomState>()(
  persist(
    (set, get) => {
  const initial = mergeBomWithSeed(null)
  const headers = initial.bomHeaders.map((h) => ({ ...h }))
  const lines = [...initial.bomLines]

  // Recalc costs only when master store is already registered (avoids circular-init TDZ).
  const masterCtx = getMasterContext()
  if (masterCtx.items.length > 0) {
    for (const h of headers) {
      h.totalCost = recalcHeaderCost(h, lines, masterCtx.items, masterCtx.getUomCode, masterCtx.getWarehouseCode)
    }
  }

  return {
    bomHeaders: headers,
    bomLines: lines,

    getBom: (id) => get().bomHeaders.find((b) => b.id === id),
    getBomsByProduct: (productId) =>
      get().bomHeaders.filter((b) => b.productId === productId),
    getLines: (bomHeaderId) =>
      get().bomLines.filter((l) => l.bomHeaderId === bomHeaderId),
    getBomTree: (bomHeaderId) => {
      const header = get().getBom(bomHeaderId)
      if (!header) return []
      const { items, getUomCode, getWarehouseCode } = getMasterContext()
      return buildBomTree(header, get().getLines(bomHeaderId), items, getUomCode, getWarehouseCode)
    },
    getFlatLines: (bomHeaderId) => flattenBomTree(get().getBomTree(bomHeaderId)),
    isMrpEligible: (bomHeaderId) => {
      const h = get().getBom(bomHeaderId)
      return h ? isMrpEligibleStatus(h.status) : false
    },
    getReleasedBomForProduct: (productId) =>
      getReleasedBomForProduct(get().bomHeaders, productId),

    createBom: (productId, description, bomNo) => {
      const product = useMasterStore.getState().getProduct(productId)
      if (!product) throw new Error('Product not found')
      const resolvedBomNo = bomNo?.trim()
      if (!resolvedBomNo) throw new Error('BOM number required from Code Series Master')
      const id = genId('bom')
      const ts = new Date().toISOString()
      const header: BomHeader = {
        id,
        bomNo: resolvedBomNo,
        productId,
        revision: 'Rev-A',
        description,
        status: 'draft',
        previousRevisionId: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        totalCost: 0,
        createdAt: ts,
        updatedAt: ts,
      }
      set((s) => ({ bomHeaders: [...s.bomHeaders, header] }))
      return id
    },

    updateBomHeader: (id, data) => {
      set((s) => ({
        bomHeaders: s.bomHeaders.map((h) =>
          h.id === id ? { ...h, ...data, updatedAt: new Date().toISOString() } : h,
        ),
      }))
    },

    addBomLine: (bomHeaderId, parentLineId, itemId, qtyPerParent, scrapPct = 0, sourceType?) => {
      const header = get().getBom(bomHeaderId)
      if (!header) return { ok: false, error: 'BOM not found' }
      if (!['draft'].includes(header.status)) {
        return { ok: false, error: 'Only draft BOMs can be edited' }
      }

      const { getItem, getVendorMapsForItem, getCategoryDefaultWh } = getMasterContext()
      const item = getItem(itemId)
      if (!item) return { ok: false, error: 'Item must exist in Item Master' }
      if (!item.isActive) return { ok: false, error: 'Cannot add inactive item' }

      const bomLines = get().getLines(bomHeaderId)
      if (hasDuplicateSiblingItem(bomLines, parentLineId, itemId)) {
        return { ok: false, error: 'Duplicate item at this BOM level' }
      }

      const vendorMap = getVendorMapsForItem(itemId)[0]
      const lineId = genId('bl')
      const sortOrder = (bomLines.filter((l) => l.parentLineId === parentLineId).length + 1) * 10

      const newLine: BomLine = {
        id: lineId,
        bomHeaderId,
        parentLineId,
        itemId,
        nodeLevel: inferNodeLevel(item, parentLineId !== null),
        qtyPerParent,
        uomId: item.baseUomId,
        scrapPct,
        sourceType: sourceType ?? inferSourceType(item),
        issueWarehouseId: inferIssueWarehouseId(item, getCategoryDefaultWh),
        leadTimeDays: vendorMap?.leadTimeDays ?? 7,
        standardCost: item.standardRate,
        sortOrder,
      }

      set((s) => ({ bomLines: [...s.bomLines, newLine] }))
      get().refreshCosts(bomHeaderId)
      return { ok: true, lineId }
    },

    updateBomLine: (lineId, data) => {
      const line = get().bomLines.find((l) => l.id === lineId)
      if (!line) return { ok: false, error: 'Line not found' }
      const header = get().getBom(line.bomHeaderId)
      if (!header || header.status !== 'draft') {
        return { ok: false, error: 'Only draft BOMs can be edited' }
      }
      set((s) => ({
        bomLines: s.bomLines.map((l) => (l.id === lineId ? { ...l, ...data } : l)),
      }))
      get().refreshCosts(line.bomHeaderId)
      return { ok: true }
    },

    removeBomLine: (lineId) => {
      const toRemove = new Set<string>()
      function collect(id: string) {
        toRemove.add(id)
        get().bomLines.filter((l) => l.parentLineId === id).forEach((c) => collect(c.id))
      }
      collect(lineId)
      const line = get().bomLines.find((l) => l.id === lineId)
      set((s) => ({ bomLines: s.bomLines.filter((l) => !toRemove.has(l.id)) }))
      if (line) get().refreshCosts(line.bomHeaderId)
    },

    cloneBom: (bomHeaderId) => {
      const source = get().getBom(bomHeaderId)!
      const newId = genId('bom')
      const ts = new Date().toISOString()
      const header: BomHeader = {
        ...source,
        id: newId,
        bomNo: getNextCode('bom'),
        revision: 'Rev-A',
        status: 'draft',
        previousRevisionId: null,
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        createdAt: ts,
        updatedAt: ts,
      }
      const sourceLines = get().getLines(bomHeaderId)
      const idMap = new Map<string, string>()
      sourceLines.forEach((l) => idMap.set(l.id, genId('bl')))
      const clonedLines = sourceLines.map((l) => ({
        ...l,
        id: idMap.get(l.id)!,
        bomHeaderId: newId,
        parentLineId: l.parentLineId ? idMap.get(l.parentLineId)! : null,
      }))
      set((s) => ({
        bomHeaders: [...s.bomHeaders, header],
        bomLines: [...s.bomLines, ...clonedLines],
      }))
      get().refreshCosts(newId)
      return newId
    },

    reviseBom: (bomHeaderId) => {
      const source = get().getBom(bomHeaderId)!
      const newId = genId('bom')
      const ts = new Date().toISOString()
      const header: BomHeader = {
        ...source,
        id: newId,
        revision: nextRevision(source.revision),
        status: 'draft',
        previousRevisionId: bomHeaderId,
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        createdAt: ts,
        updatedAt: ts,
      }
      set((s) => ({
        bomHeaders: [
          ...s.bomHeaders.map((h) =>
            h.id === bomHeaderId && h.status === 'approved'
              ? { ...h, status: 'obsolete' as BomStatus }
              : h,
          ),
          header,
        ],
      }))
      const sourceLines = get().getLines(bomHeaderId)
      const idMap = new Map<string, string>()
      sourceLines.forEach((l) => idMap.set(l.id, genId('bl')))
      const clonedLines = sourceLines.map((l) => ({
        ...l,
        id: idMap.get(l.id)!,
        bomHeaderId: newId,
        parentLineId: l.parentLineId ? idMap.get(l.parentLineId)! : null,
      }))
      set((s) => ({ bomLines: [...s.bomLines, ...clonedLines] }))
      get().refreshCosts(newId)
      return newId
    },

    submitForApproval: (bomHeaderId) => {
      const header = get().getBom(bomHeaderId)!
      if (header.status !== 'draft') return { ok: false, error: 'Only draft BOMs can be submitted' }
      const lines = get().getLines(bomHeaderId)
      if (lines.length === 0) return { ok: false, error: 'BOM must have at least one line' }
      const { items } = getMasterContext()
      if (hasInactiveItems(lines, items)) {
        return { ok: false, error: 'BOM contains inactive items — resolve before submission' }
      }
      const user = getSessionUser()
      syncApprovalRequest({
        documentType: 'bom_revision',
        entityId: bomHeaderId,
        entityLabel: `${header.bomNo} Rev ${header.revision}`,
        context: buildApprovalContext('bom_revision', header),
        submittedByName: user.name,
      })
      get().updateBomHeader(bomHeaderId, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        submittedBy: user.name,
      })
      return { ok: true }
    },

    approveBom: (bomHeaderId, approvedBy) => {
      const header = get().getBom(bomHeaderId)!
      if (header.status !== 'submitted') {
        return { ok: false, error: 'BOM must be submitted to approve' }
      }
      const lines = get().getLines(bomHeaderId)
      const { items } = getMasterContext()
      if (hasInactiveItems(lines, items)) {
        return { ok: false, error: 'Cannot approve — inactive items in BOM' }
      }

      const user = getSessionUser()
      const matrixCheck = assertMatrixApproval('bom_revision', bomHeaderId, user)
      if (!matrixCheck.ok) return matrixCheck

      const advance = advanceApprovalStep('bom_revision', bomHeaderId, user)
      if (!advance.ok) return advance
      if (!advance.completed) {
        return { ok: true, pendingNextApprover: advance.nextApprover }
      }

      get().updateBomHeader(bomHeaderId, {
        status: 'approved',
        approvedBy: approvedBy || user.name,
        approvedAt: new Date().toISOString(),
      })
      return { ok: true }
    },

    releaseBom: (bomHeaderId) => {
      const check = assertBomReleaseDocuments(bomHeaderId)
      if (!check.ok) throw new Error(check.error)
      get().updateBomHeader(bomHeaderId, { status: 'released' })
    },

    refreshCosts: (bomHeaderId) => {
      const header = get().getBom(bomHeaderId)
      if (!header) return
      const { items, getUomCode, getWarehouseCode } = getMasterContext()
      const totalCost = recalcHeaderCost(header, get().bomLines, items, getUomCode, getWarehouseCode)
      get().updateBomHeader(bomHeaderId, { totalCost })
    },
  }
    },
    {
      name: ERP_STORAGE_KEYS.bom,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        bomHeaders: s.bomHeaders,
        bomLines: s.bomLines,
      }),
      merge: (persisted, current) => {
        const merged = mergeBomWithSeed(persisted as Partial<BomPersistSlice> | undefined)
        return { ...current, ...merged }
      },
    },
  ),
)

registerBomStore(() => useBomStore.getState())
