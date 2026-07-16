import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { erpStorage, ERP_STORAGE_KEYS } from './persistConfig'

export type GateEntryDirection = 'inward' | 'outward'

export interface GateEntry {
  id: string
  direction: GateEntryDirection
  vehicleNo: string
  driverName: string
  driverMobile: string
  partyName: string
  purpose: string
  referenceNo: string
  referenceType?: 'po' | 'dispatch' | 'jwo' | 'visitor'
  entryTime: string
  exitTime?: string
  gatePassId?: string
  dispatchId?: string
  poId?: string
  remarks?: string
  photoDataUrl?: string
  status: 'inside' | 'exited' | 'pending'
}

interface MobileGateState {
  entries: GateEntry[]
  createInward: (input: Omit<GateEntry, 'id' | 'direction' | 'status' | 'entryTime'> & { entryTime?: string }) => GateEntry
  createOutward: (input: Omit<GateEntry, 'id' | 'direction' | 'status' | 'entryTime'> & { exitTime: string; entryTime?: string }) => { ok: boolean; error?: string; entry?: GateEntry }
  getInsideVehicles: () => GateEntry[]
  getPendingOutward: () => GateEntry[]
}

function genId() {
  return `gate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useMobileGateStore = create<MobileGateState>()(
  persist(
    (set, get) => ({
      entries: [],

      createInward: (input) => {
        const entry: GateEntry = {
          id: genId(),
          direction: 'inward',
          status: 'inside',
          entryTime: input.entryTime ?? new Date().toISOString(),
          vehicleNo: input.vehicleNo,
          driverName: input.driverName,
          driverMobile: input.driverMobile,
          partyName: input.partyName,
          purpose: input.purpose,
          referenceNo: input.referenceNo,
          referenceType: input.referenceType,
          dispatchId: input.dispatchId,
          poId: input.poId,
          gatePassId: input.gatePassId,
          remarks: input.remarks,
          photoDataUrl: input.photoDataUrl,
        }
        set((s) => ({ entries: [entry, ...s.entries] }))
        return entry
      },

      createOutward: (input) => {
        if (!input.gatePassId && !input.dispatchId) {
          return { ok: false, error: 'Outward gate requires approved gate pass or dispatch reference' }
        }
        const inside = get().entries.find(
          (e) => e.direction === 'inward' && e.status === 'inside' && e.vehicleNo.toUpperCase() === input.vehicleNo.toUpperCase(),
        )
        const entry: GateEntry = {
          id: genId(),
          direction: 'outward',
          status: 'exited',
          vehicleNo: input.vehicleNo,
          driverName: input.driverName,
          driverMobile: input.driverMobile,
          partyName: input.partyName,
          purpose: input.purpose,
          referenceNo: input.referenceNo,
          referenceType: input.referenceType,
          entryTime: input.entryTime ?? inside?.entryTime ?? new Date().toISOString(),
          exitTime: input.exitTime,
          gatePassId: input.gatePassId,
          dispatchId: input.dispatchId,
          poId: input.poId,
          remarks: input.remarks,
        }
        set((s) => ({
          entries: [
            entry,
            ...s.entries.map((e) =>
              e.id === inside?.id ? { ...e, status: 'exited' as const, exitTime: input.exitTime } : e,
            ),
          ],
        }))
        return { ok: true, entry }
      },

      getInsideVehicles: () => get().entries.filter((e) => e.direction === 'inward' && e.status === 'inside'),
      getPendingOutward: () =>
        get().entries.filter((e) => e.direction === 'inward' && e.status === 'inside'),
    }),
    {
      name: ERP_STORAGE_KEYS.mobileGate,
      storage: erpStorage,
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
)
