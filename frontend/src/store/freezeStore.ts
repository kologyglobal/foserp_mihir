import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FreezeStatus, SalesOrderFreeze } from '../types/functionalFreeze'
import { getSessionUser, assertPermission } from '../utils/permissions'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { useMrpStore } from './mrpStore'
import { useMasterStore } from './masterStore'
import { useBomStore } from './bomStore'
import { useRoutingStore } from './routingStore'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface FreezeState {
  freezes: SalesOrderFreeze[]

  getFreeze: (id: string) => SalesOrderFreeze | undefined
  getFreezeForSo: (salesOrderId: string) => SalesOrderFreeze | undefined
  listFreezes: () => SalesOrderFreeze[]

  createFreezeForSo: (salesOrderId: string, customerSpecRef?: string) => { ok: boolean; error?: string; freezeId?: string }
  requestChange: (freezeId: string, reason: string) => { ok: boolean; error?: string }
  approveChange: (freezeId: string) => { ok: boolean; error?: string }
  releaseFreeze: (freezeId: string) => { ok: boolean; error?: string }

  assertSoProductionAllowed: (salesOrderId: string) => { ok: boolean; error?: string }
  assertRevisionMatchesFreeze: (salesOrderId: string, bomId: string, routingId: string) => { ok: boolean; error?: string }
}

export const useFreezeStore = create<FreezeState>()(
  persist(
    (set, get) => ({
      freezes: [],

      getFreeze: (id) => get().freezes.find((f) => f.id === id),
      getFreezeForSo: (salesOrderId) =>
        get().freezes.find((f) => f.salesOrderId === salesOrderId && f.status === 'active'),
      listFreezes: () => [...get().freezes].sort((a, b) => b.frozenAt.localeCompare(a.frozenAt)),

      createFreezeForSo: (salesOrderId, customerSpecRef = '') => {
        const salesPerm = assertPermission('sales', 'approve')
        const prodPerm = assertPermission('production', 'create')
        if (!salesPerm.ok && !prodPerm.ok) return salesPerm
        const so = useMrpStore.getState().getSalesOrder(salesOrderId)
        if (!so) return { ok: false, error: 'Sales order not found' }
        if (get().getFreezeForSo(salesOrderId)) return { ok: false, error: 'SO already frozen' }

        const master = useMasterStore.getState()
        const product = master.getProduct(so.productId)
        if (!product) return { ok: false, error: 'Product not found' }
        const bom = useBomStore.getState().getReleasedBomForProduct(so.productId)
        if (!bom) return { ok: false, error: 'Released BOM required before freeze' }
        const routing = useRoutingStore.getState().getReleasedRoutingForProduct(so.productId)
        if (!routing) return { ok: false, error: 'Released routing required before freeze' }
        const productDetail = master.getProduct(so.productId)
        const user = getSessionUser()
        const now = ts()

        const freeze: SalesOrderFreeze = {
          id: genId('frz'),
          salesOrderId,
          salesOrderNo: so.salesOrderNo,
          status: 'active',
          productId: so.productId,
          productCode: product.productCode,
          productRevision: productDetail?.productRevision ?? 'A',
          bomId: bom.id,
          bomNo: bom.bomNo,
          bomRevision: bom.revision,
          routingId: routing.id,
          routingNo: routing.routingNo,
          routingRevision: routing.revision,
          costBaseline: productDetail?.standardCost?.totalCost ?? 0,
          deliveryCommitment: so.requiredDate,
          customerSpecRef,
          frozenAt: now,
          frozenBy: user.name,
          changeRequestReason: null,
          changeApprovedBy: null,
          changeApprovedAt: null,
          releasedAt: null,
          releasedBy: null,
        }
        set((s) => ({ freezes: [freeze, ...s.freezes] }))
        return { ok: true, freezeId: freeze.id }
      },

      requestChange: (freezeId, reason) => {
        const perm = assertPermission('engineering', 'edit')
        if (!perm.ok) return perm
        const freeze = get().getFreeze(freezeId)
        if (!freeze) return { ok: false, error: 'Freeze not found' }
        if (freeze.status !== 'active') return { ok: false, error: 'Freeze not active' }
        set((s) => ({
          freezes: s.freezes.map((f) =>
            f.id === freezeId ? { ...f, status: 'change_requested' as FreezeStatus, changeRequestReason: reason } : f,
          ),
        }))
        return { ok: true }
      },

      approveChange: (freezeId) => {
        const perm = assertPermission('engineering', 'approve')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          freezes: s.freezes.map((f) =>
            f.id === freezeId
              ? {
                  ...f,
                  status: 'released' as FreezeStatus,
                  changeApprovedBy: user.name,
                  changeApprovedAt: now,
                  releasedAt: now,
                  releasedBy: user.name,
                }
              : f,
          ),
        }))
        return { ok: true }
      },

      releaseFreeze: (freezeId) => {
        const perm = assertPermission('sales', 'approve')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          freezes: s.freezes.map((f) =>
            f.id === freezeId
              ? { ...f, status: 'released' as FreezeStatus, releasedAt: now, releasedBy: user.name }
              : f,
          ),
        }))
        return { ok: true }
      },

      assertSoProductionAllowed: (salesOrderId) => {
        const freeze = get().getFreezeForSo(salesOrderId)
        if (!freeze) {
          return { ok: false, error: 'SO must be frozen before production — confirm SO and create functional freeze' }
        }
        if (freeze.status !== 'active') {
          return { ok: false, error: `SO freeze is ${freeze.status} — production blocked` }
        }
        return { ok: true }
      },

      assertRevisionMatchesFreeze: (salesOrderId, bomId, routingId) => {
        const freeze = get().getFreezeForSo(salesOrderId)
        if (!freeze) return { ok: true }
        if (freeze.bomId !== bomId) {
          return {
            ok: false,
            error: `BOM revision drift — SO frozen on ${freeze.bomNo} Rev ${freeze.bomRevision}`,
          }
        }
        if (freeze.routingId !== routingId) {
          return {
            ok: false,
            error: `Routing revision drift — SO frozen on ${freeze.routingNo} Rev ${freeze.routingRevision}`,
          }
        }
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.freeze,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)

export function assertSoFrozenForProduction(salesOrderId: string): { ok: boolean; error?: string } {
  return useFreezeStore.getState().assertSoProductionAllowed(salesOrderId)
}
