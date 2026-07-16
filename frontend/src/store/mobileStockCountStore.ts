import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { erpStorage, ERP_STORAGE_KEYS } from './persistConfig'
import { useInventoryStore } from './inventoryStore'
import { useMasterStore } from './masterStore'

export type StockCountSessionStatus = 'draft' | 'submitted' | 'approved' | 'posted'

export interface StockCountLine {
  id: string
  itemId: string
  itemCode: string
  warehouseId: string
  systemQty: number
  countedQty: number
  variance: number
  remarks?: string
}

export interface StockCountSession {
  id: string
  warehouseId: string
  warehouseName: string
  status: StockCountSessionStatus
  lines: StockCountLine[]
  createdAt: string
  submittedAt?: string
  requiresApproval: boolean
}

const VARIANCE_APPROVAL_THRESHOLD = 10

interface MobileStockCountState {
  sessions: StockCountSession[]
  startSession: (warehouseId: string) => StockCountSession
  addCountLine: (sessionId: string, itemId: string, countedQty: number, remarks?: string) => { ok: boolean; error?: string }
  submitSession: (sessionId: string) => { ok: boolean; error?: string; requiresApproval?: boolean }
  approveAndPost: (sessionId: string) => { ok: boolean; error?: string }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useMobileStockCountStore = create<MobileStockCountState>()(
  persist(
    (set, get) => ({
      sessions: [],

      startSession: (warehouseId) => {
        const wh = useMasterStore.getState().getWarehouse(warehouseId)
        const session: StockCountSession = {
          id: genId('sc'),
          warehouseId,
          warehouseName: wh?.warehouseName ?? warehouseId,
          status: 'draft',
          lines: [],
          createdAt: new Date().toISOString(),
          requiresApproval: false,
        }
        set((s) => ({ sessions: [session, ...s.sessions] }))
        return session
      },

      addCountLine: (sessionId, itemId, countedQty, remarks) => {
        const session = get().sessions.find((s) => s.id === sessionId)
        if (!session) return { ok: false, error: 'Session not found' }
        if (session.status !== 'draft') return { ok: false, error: 'Session is not editable' }
        const item = useMasterStore.getState().getItem(itemId)
        if (!item) return { ok: false, error: 'Item not found' }
        const systemQty = useInventoryStore.getState().getFreeQty(itemId, session.warehouseId)
        const variance = countedQty - systemQty
        const line: StockCountLine = {
          id: genId('scl'),
          itemId,
          itemCode: item.itemCode,
          warehouseId: session.warehouseId,
          systemQty,
          countedQty,
          variance,
          remarks,
        }
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, lines: [...sess.lines.filter((l) => l.itemId !== itemId), line] }
              : sess,
          ),
        }))
        return { ok: true }
      },

      submitSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId)
        if (!session) return { ok: false, error: 'Session not found' }
        if (session.lines.length === 0) return { ok: false, error: 'Add at least one count line' }
        const maxVariance = Math.max(...session.lines.map((l) => Math.abs(l.variance)))
        const requiresApproval = maxVariance > VARIANCE_APPROVAL_THRESHOLD
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  status: requiresApproval ? 'submitted' : 'approved',
                  submittedAt: new Date().toISOString(),
                  requiresApproval,
                }
              : sess,
          ),
        }))
        if (!requiresApproval) {
          return get().approveAndPost(sessionId)
        }
        return { ok: true, requiresApproval: true }
      },

      approveAndPost: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId)
        if (!session) return { ok: false, error: 'Session not found' }
        const inv = useInventoryStore.getState()
        for (const line of session.lines) {
          if (line.variance === 0) continue
          const isPositive = line.variance > 0
          const r = inv.postAdjustment({
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            qty: Math.abs(line.variance),
            isPositive,
            referenceNo: `SC-${session.id.slice(-6)}`,
            remarks: line.remarks ?? 'Mobile stock count adjustment',
          })
          if (!r.ok) return { ok: false, error: r.error ?? 'Adjustment failed' }
        }
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, status: 'posted' as const } : sess,
          ),
        }))
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.mobileStockCount,
      storage: erpStorage,
      partialize: (s) => ({ sessions: s.sessions }),
    },
  ),
)
