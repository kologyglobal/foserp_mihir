import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EcoImpactAnalysis,
  EcoStatus,
  EngineeringChangeOrder,
  EngineeringChangeRequest,
  EcrChangeType,
  EcrPriority,
  EcrStatus,
} from '../types/engineeringChange'
import { getSessionUser, assertPermission } from '../utils/permissions'
import { nextDocumentNo } from '../utils/documentNumbers'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { useMasterStore } from './masterStore'
import { useBomStore } from './bomStore'
import { useRoutingStore } from './routingStore'
import { useMrpStore } from './mrpStore'
import { useWorkOrderStore } from './workOrderStore'
import { usePurchaseStore } from './purchaseStore'
import { useInventoryStore } from './inventoryStore'
import { useProductMasterStore } from './productMasterStore'
import { syncApprovalRequest, assertMatrixApproval, advanceApprovalStep } from '../utils/approvalEngine'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface EcoState {
  ecrs: EngineeringChangeRequest[]
  ecos: EngineeringChangeOrder[]

  getEcr: (id: string) => EngineeringChangeRequest | undefined
  getEco: (id: string) => EngineeringChangeOrder | undefined
  getEcrByEco: (ecoId: string) => EngineeringChangeRequest | undefined
  listEcrs: () => EngineeringChangeRequest[]
  listEcos: () => EngineeringChangeOrder[]

  createEcr: (input: {
    changeType: EcrChangeType
    productId?: string | null
    bomId?: string | null
    routingId?: string | null
    itemId?: string | null
    reason: string
    priority?: EcrPriority
  }) => { ok: boolean; error?: string; ecrId?: string }

  submitEcr: (ecrId: string) => { ok: boolean; error?: string }
  startEngineeringReview: (ecrId: string, remarks?: string) => { ok: boolean; error?: string }
  completeImpactAnalysis: (ecrId: string) => { ok: boolean; error?: string }
  approveEcrForEco: (ecrId: string) => { ok: boolean; error?: string; ecoId?: string }

  submitEcoForApproval: (ecoId: string) => { ok: boolean; error?: string }
  approveEco: (ecoId: string) => { ok: boolean; error?: string }
  releaseEco: (ecoId: string) => { ok: boolean; error?: string }
  implementEco: (ecoId: string) => { ok: boolean; error?: string }

  computeImpactAnalysis: (ecrId: string) => EcoImpactAnalysis
  requiresEcoForBomEdit: (bomId: string) => boolean
  requiresEcoForRoutingEdit: (routingId: string) => boolean
}

export const useEcoStore = create<EcoState>()(
  persist(
    (set, get) => ({
      ecrs: [],
      ecos: [],

      getEcr: (id) => get().ecrs.find((e) => e.id === id),
      getEco: (id) => get().ecos.find((e) => e.id === id),
      getEcrByEco: (ecoId) => {
        const eco = get().getEco(ecoId)
        return eco ? get().getEcr(eco.ecrId) : undefined
      },
      listEcrs: () => [...get().ecrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      listEcos: () => [...get().ecos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      createEcr: (input) => {
        const perm = assertPermission('engineering', 'create')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const now = ts()
        const ecrNo = nextDocumentNo('ECR-', get().ecrs.map((e) => e.ecrNo))
        const ecr: EngineeringChangeRequest = {
          id: genId('ecr'),
          ecrNo,
          changeType: input.changeType,
          productId: input.productId ?? null,
          bomId: input.bomId ?? null,
          routingId: input.routingId ?? null,
          itemId: input.itemId ?? null,
          reason: input.reason,
          requestedBy: user.name,
          priority: input.priority ?? 'medium',
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          submittedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          reviewRemarks: '',
        }
        set((s) => ({ ecrs: [ecr, ...s.ecrs] }))
        return { ok: true, ecrId: ecr.id }
      },

      submitEcr: (ecrId) => {
        const perm = assertPermission('engineering', 'edit')
        if (!perm.ok) return perm
        const ecr = get().getEcr(ecrId)
        if (!ecr) return { ok: false, error: 'ECR not found' }
        if (ecr.status !== 'draft') return { ok: false, error: 'Only draft ECR can be submitted' }
        if (!ecr.reason.trim()) return { ok: false, error: 'Reason is required' }
        const now = ts()
        set((s) => ({
          ecrs: s.ecrs.map((e) =>
            e.id === ecrId ? { ...e, status: 'submitted' as EcrStatus, submittedAt: now, updatedAt: now } : e,
          ),
        }))
        return { ok: true }
      },

      startEngineeringReview: (ecrId, remarks = '') => {
        const perm = assertPermission('engineering', 'approve')
        if (!perm.ok) return perm
        const ecr = get().getEcr(ecrId)
        if (!ecr) return { ok: false, error: 'ECR not found' }
        if (ecr.status !== 'submitted' && ecr.status !== 'under_review') {
          return { ok: false, error: 'ECR must be submitted before review' }
        }
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          ecrs: s.ecrs.map((e) =>
            e.id === ecrId
              ? {
                  ...e,
                  status: 'under_review' as EcrStatus,
                  reviewedBy: user.name,
                  reviewedAt: now,
                  reviewRemarks: remarks,
                  updatedAt: now,
                }
              : e,
          ),
        }))
        return { ok: true }
      },

      completeImpactAnalysis: (ecrId) => {
        const perm = assertPermission('engineering', 'approve')
        if (!perm.ok) return perm
        const ecr = get().getEcr(ecrId)
        if (!ecr) return { ok: false, error: 'ECR not found' }
        if (ecr.status !== 'under_review') return { ok: false, error: 'ECR must be under review' }
        set((s) => ({
          ecrs: s.ecrs.map((e) =>
            e.id === ecrId ? { ...e, status: 'impact_analysis' as EcrStatus, updatedAt: ts() } : e,
          ),
        }))
        return { ok: true }
      },

      approveEcrForEco: (ecrId) => {
        const perm = assertPermission('engineering', 'approve')
        if (!perm.ok) return perm
        const ecr = get().getEcr(ecrId)
        if (!ecr) return { ok: false, error: 'ECR not found' }
        if (ecr.status !== 'impact_analysis') return { ok: false, error: 'Complete impact analysis first' }
        const now = ts()
        const ecoNo = nextDocumentNo('ECO-', get().ecos.map((e) => e.ecoNo))
        const eco: EngineeringChangeOrder = {
          id: genId('eco'),
          ecoNo,
          ecrId,
          effectiveDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          affectedProductId: ecr.productId,
          affectedBomId: ecr.bomId,
          affectedRoutingId: ecr.routingId,
          costImpact: 0,
          approvalStatus: 'draft',
          createdAt: now,
          updatedAt: now,
          approvedBy: null,
          approvedAt: null,
          releasedBy: null,
          releasedAt: null,
          implementedAt: null,
          remarks: '',
        }
        set((s) => ({
          ecrs: s.ecrs.map((e) =>
            e.id === ecrId ? { ...e, status: 'approved_for_eco' as EcrStatus, updatedAt: now } : e,
          ),
          ecos: [eco, ...s.ecos],
        }))
        return { ok: true, ecoId: eco.id }
      },

      submitEcoForApproval: (ecoId) => {
        const perm = assertPermission('engineering', 'edit')
        if (!perm.ok) return perm
        const eco = get().getEco(ecoId)
        if (!eco) return { ok: false, error: 'ECO not found' }
        if (eco.approvalStatus !== 'draft') return { ok: false, error: 'Only draft ECO can be submitted' }
        const user = getSessionUser()
        syncApprovalRequest({
          documentType: 'engineering_change',
          entityId: ecoId,
          entityLabel: eco.ecoNo,
          context: { isRevision: true, totalAmount: eco.costImpact },
          submittedByName: user.name,
        })
        set((s) => ({
          ecos: s.ecos.map((e) =>
            e.id === ecoId ? { ...e, approvalStatus: 'pending_approval' as EcoStatus, updatedAt: ts() } : e,
          ),
        }))
        return { ok: true }
      },

      approveEco: (ecoId) => {
        const perm = assertPermission('engineering', 'approve')
        if (!perm.ok) return perm
        const eco = get().getEco(ecoId)
        if (!eco) return { ok: false, error: 'ECO not found' }
        if (eco.approvalStatus !== 'pending_approval') return { ok: false, error: 'ECO not pending approval' }
        const user = getSessionUser()
        const matrixCheck = assertMatrixApproval('engineering_change', ecoId, user)
        if (!matrixCheck.ok) return matrixCheck
        const advance = advanceApprovalStep('engineering_change', ecoId, user)
        if (!advance.ok) return advance
        if (!advance.completed) return { ok: true }
        const now = ts()
        set((s) => ({
          ecos: s.ecos.map((e) =>
            e.id === ecoId
              ? { ...e, approvalStatus: 'approved' as EcoStatus, approvedBy: user.name, approvedAt: now, updatedAt: now }
              : e,
          ),
        }))
        return { ok: true }
      },

      releaseEco: (ecoId) => {
        const perm = assertPermission('engineering', 'release')
        if (!perm.ok) return perm
        const eco = get().getEco(ecoId)
        if (!eco) return { ok: false, error: 'ECO not found' }
        if (eco.approvalStatus !== 'approved') return { ok: false, error: 'ECO must be approved before release' }
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          ecos: s.ecos.map((e) =>
            e.id === ecoId
              ? { ...e, approvalStatus: 'released' as EcoStatus, releasedBy: user.name, releasedAt: now, updatedAt: now }
              : e,
          ),
        }))
        return { ok: true }
      },

      implementEco: (ecoId) => {
        const perm = assertPermission('engineering', 'post')
        if (!perm.ok) return perm
        const eco = get().getEco(ecoId)
        if (!eco) return { ok: false, error: 'ECO not found' }
        if (eco.approvalStatus !== 'released') return { ok: false, error: 'ECO must be released before implement' }
        const bomStore = useBomStore.getState()
        const routingStore = useRoutingStore.getState()
        const productStore = useProductMasterStore.getState()
        if (eco.affectedBomId) {
          const bom = bomStore.getBom(eco.affectedBomId)
          if (bom && (bom.status === 'released' || bom.status === 'approved')) {
            bomStore.reviseBom(eco.affectedBomId)
          }
        }
        if (eco.affectedRoutingId) {
          const routing = routingStore.getRouting(eco.affectedRoutingId)
          if (routing && routing.status === 'released') {
            routingStore.reviseRouting(eco.affectedRoutingId)
          }
        }
        if (eco.affectedProductId) {
          const prod = useMasterStore.getState().getProduct(eco.affectedProductId)
          const nextRev = prod
            ? String.fromCharCode((prod.productRevision?.charCodeAt(0) ?? 64) + 1)
            : 'B'
          productStore.createProductRevision(eco.affectedProductId, {
            revisionNo: nextRev,
            revisionReason: `ECO ${eco.ecoNo} implementation`,
            engineeringOwner: getSessionUser().name,
          })
        }
        const now = ts()
        set((s) => ({
          ecos: s.ecos.map((e) =>
            e.id === ecoId
              ? { ...e, approvalStatus: 'implemented' as EcoStatus, implementedAt: now, updatedAt: now }
              : e,
          ),
        }))
        return { ok: true }
      },

      computeImpactAnalysis: (ecrId) => {
        const ecr = get().getEcr(ecrId)
        const master = useMasterStore.getState()
        const bomStore = useBomStore.getState()
        const mrp = useMrpStore.getState()
        const woStore = useWorkOrderStore.getState()
        const purchase = usePurchaseStore.getState()
        const inventory = useInventoryStore.getState()

        const products = ecr?.productId
          ? (() => {
              const p = master.getProduct(ecr.productId!)
              return p ? [{ id: p.id, code: p.productCode, name: p.productName }] : []
            })()
          : master.products.slice(0, 5).map((p) => ({ id: p.id, code: p.productCode, name: p.productName }))

        const boms = ecr?.bomId
          ? (() => {
              const b = bomStore.getBom(ecr.bomId!)
              return b ? [{ id: b.id, bomNo: b.bomNo, revision: b.revision, status: b.status }] : []
            })()
          : bomStore.bomHeaders
              .filter((b) => (ecr?.productId ? b.productId === ecr.productId : true))
              .slice(0, 10)
              .map((b) => ({ id: b.id, bomNo: b.bomNo, revision: b.revision, status: b.status }))

        const openSalesOrders = mrp.salesOrders
          .filter((so) => so.status === 'open' || so.status === 'confirmed')
          .filter((so) => !ecr?.productId || so.productId === ecr.productId)
          .map((so) => ({ id: so.id, salesOrderNo: so.salesOrderNo, status: so.status, qty: so.qty }))

        const openWorkOrders = woStore.workOrders
          .filter((wo) => wo.status !== 'closed' && wo.status !== 'cancelled')
          .filter((wo) => !ecr?.productId || wo.productId === ecr.productId)
          .map((wo) => ({ id: wo.id, woNo: wo.woNo, status: wo.status, bomRevision: wo.bomRevision }))

        const openPurchaseOrders = purchase.purchaseOrders
          .filter((po) => po.status !== 'closed' && po.status !== 'cancelled')
          .map((po) => ({
            id: po.id,
            poNo: po.poNo,
            status: po.status,
            totalAmount: po.lines.reduce((s, l) => s + l.qty * l.rate, 0),
          }))

        const openPurchaseRequisitions = purchase.requisitions
          .filter((pr) => !['converted', 'cancelled'].includes(pr.status))
          .map((pr) => ({ id: pr.id, prNo: pr.prNo, status: pr.status }))

        const defaultWh = master.warehouses[0]?.id ?? ''
        const inventoryItems = master.items.slice(0, 20).map((item) => ({
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          freeQty: inventory.getFreeQty(item.id, defaultWh),
        }))

        const costSheets = products.map((p) => {
          const prod = master.getProduct(p.id)
          return {
            productId: p.id,
            productCode: p.code,
            standardCost: prod?.standardCost?.totalCost ?? 0,
          }
        })

        return {
          products,
          boms,
          openSalesOrders,
          openWorkOrders,
          openPurchaseOrders,
          openPurchaseRequisitions,
          inventoryItems,
          costSheets,
        }
      },

      requiresEcoForBomEdit: (bomId) => {
        const bom = useBomStore.getState().getBom(bomId)
        return bom?.status === 'released' || bom?.status === 'approved'
      },

      requiresEcoForRoutingEdit: (routingId) => {
        const routing = useRoutingStore.getState().getRouting(routingId)
        return routing?.status === 'released'
      },
    }),
    {
      name: ERP_STORAGE_KEYS.eco,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)

export function assertEcoRequiredForBom(bomId: string): { ok: boolean; error?: string } {
  if (useEcoStore.getState().requiresEcoForBomEdit(bomId)) {
    return { ok: false, error: 'Released BOM cannot be edited directly — create an ECR/ECO first' }
  }
  return { ok: true }
}

export function assertEcoRequiredForRouting(routingId: string): { ok: boolean; error?: string } {
  if (useEcoStore.getState().requiresEcoForRoutingEdit(routingId)) {
    return { ok: false, error: 'Released Routing cannot be edited directly — create an ECR/ECO first' }
  }
  return { ok: true }
}
