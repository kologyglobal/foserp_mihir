import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobWorkMeta } from '../types/jobWork'
import { shipmentBalance } from '../utils/jobWorkAdapter'
import { erpStorage } from './persistConfig'
import { useWorkOrderStore } from './workOrderStore'
import { useQualityStore } from './qualityStore'

function ts() {
  return new Date().toISOString()
}

interface JobWorkExecutionState {
  metaByWoId: Record<string, JobWorkMeta>

  getMeta: (woId: string) => JobWorkMeta | undefined
  approveJobWork: (woId: string, rate?: number) => { ok: boolean; error?: string }
  setJobWorkRate: (woId: string, rate: number) => void

  sendJobWorkMaterial: (input: {
    woId: string
    lineId: string
    vendorId: string
    challanNo: string
    qty: number
    expectedReturnDate: string
    warehouseId?: string
    vehicleNo?: string
    driver?: string
  }) => { ok: boolean; error?: string; shipmentId?: string }

  receiveJobWorkMaterial: (input: {
    shipmentId: string
    acceptedQty: number
    rejectedQty: number
    reworkQty: number
    qcRequired: boolean
    remarks?: string
    reportedBy?: string
  }) => { ok: boolean; error?: string; ncrId?: string; inspectionId?: string }

  closeJobWork: (woId: string) => { ok: boolean; error?: string }
}

export const useJobWorkExecutionStore = create<JobWorkExecutionState>()(
  persist(
    (set, get) => ({
      metaByWoId: {},

      getMeta: (woId) => get().metaByWoId[woId],

      approveJobWork: (woId, rate) => {
        const wo = useWorkOrderStore.getState().getWorkOrder(woId)
        if (!wo) return { ok: false, error: 'Work order not found' }
        if (wo.woType !== 'subcontract') return { ok: false, error: 'Not a subcontract work order' }
        const now = ts()
        set((s) => ({
          metaByWoId: {
            ...s.metaByWoId,
            [woId]: {
              workOrderId: woId,
              approvedAt: now,
              rate: rate ?? s.metaByWoId[woId]?.rate ?? 0,
              closedAt: s.metaByWoId[woId]?.closedAt ?? null,
            },
          },
        }))
        return { ok: true }
      },

      setJobWorkRate: (woId, rate) => {
        set((s) => ({
          metaByWoId: {
            ...s.metaByWoId,
            [woId]: {
              workOrderId: woId,
              approvedAt: s.metaByWoId[woId]?.approvedAt ?? null,
              rate,
              closedAt: s.metaByWoId[woId]?.closedAt ?? null,
            },
          },
        }))
      },

      sendJobWorkMaterial: (input) => {
        const meta = get().metaByWoId[input.woId]
        if (!meta?.approvedAt) {
          const approve = get().approveJobWork(input.woId)
          if (!approve.ok) return approve
        }

        const woStore = useWorkOrderStore.getState()
        const result = woStore.sendSubcontractMaterial(
          input.woId,
          input.lineId,
          input.vendorId,
          input.challanNo,
          input.qty,
          input.expectedReturnDate,
        )
        if (!result.ok) return result

        const updatedStore = useWorkOrderStore.getState()
        const shipment = updatedStore.subcontractShipments.find(
          (s) => s.workOrderId === input.woId && s.challanNo === input.challanNo,
        )
        if (shipment && (input.vehicleNo || input.driver)) {
          useWorkOrderStore.setState((s) => ({
            subcontractShipments: s.subcontractShipments.map((sh) =>
              sh.id === shipment.id
                ? { ...sh, vehicleNo: input.vehicleNo, driver: input.driver, reworkQty: sh.reworkQty ?? 0 }
                : sh,
            ),
          }))
        }

        return { ok: true, shipmentId: shipment?.id }
      },

      receiveJobWorkMaterial: (input) => {
        const woStore = useWorkOrderStore.getState()
        const shipment = woStore.subcontractShipments.find((s) => s.id === input.shipmentId)
        if (!shipment) return { ok: false, error: 'Shipment not found' }

        const balance = shipmentBalance(shipment)
        const total = input.acceptedQty + input.rejectedQty + input.reworkQty
        if (total <= 0) return { ok: false, error: 'Enter accepted, rejected, or rework quantity' }
        if (total > balance) {
          return { ok: false, error: `Cannot receive more than balance (${balance})` }
        }

        const wo = woStore.getWorkOrder(shipment.workOrderId)
        if (!wo) return { ok: false, error: 'Work order not found' }

        let ncrId: string | undefined
        let inspectionId: string | undefined

        if (input.rejectedQty > 0) {
          const ncrResult = useQualityStore.getState().createSubcontractReturnNcr({
            workOrderId: wo.id,
            woNo: wo.woNo,
            vendorId: shipment.vendorId,
            subcontractShipmentId: shipment.id,
            itemId: wo.outputItemId,
            itemCode: wo.outputItemCode,
            rejectedQty: input.rejectedQty,
            remarks: input.remarks ?? 'Subcontract return rejection',
            reportedBy: input.reportedBy ?? 'Store',
          })
          if (!ncrResult.ok) return ncrResult
          ncrId = ncrResult.ncrId
        }

        if (input.qcRequired && input.acceptedQty > 0) {
          inspectionId = useQualityStore.getState().createSubcontractReturnInspection({
            workOrderId: wo.id,
            woNo: wo.woNo,
            vendorId: shipment.vendorId,
            subcontractShipmentId: shipment.id,
            itemId: wo.outputItemId,
            itemCode: wo.outputItemCode,
            qty: input.acceptedQty,
          })
        }

        if (input.acceptedQty > 0 || input.rejectedQty > 0) {
          const recv = woStore.receiveSubcontractMaterial(
            input.shipmentId,
            input.acceptedQty,
            input.rejectedQty,
          )
          if (!recv.ok) return recv
        }

        if (input.reworkQty > 0 || input.qcRequired || ncrId || inspectionId) {
          useWorkOrderStore.setState((s) => ({
            subcontractShipments: s.subcontractShipments.map((sh) =>
              sh.id === input.shipmentId
                ? {
                    ...sh,
                    reworkQty: (sh.reworkQty ?? 0) + input.reworkQty,
                    qcRequired: input.qcRequired || sh.qcRequired,
                    qcInspectionId: inspectionId ?? sh.qcInspectionId ?? null,
                    ncrIds: ncrId ? [...(sh.ncrIds ?? []), ncrId] : sh.ncrIds,
                    remarks: input.remarks ?? sh.remarks,
                  }
                : sh,
            ),
          }))
        }

        return { ok: true, ncrId, inspectionId }
      },

      closeJobWork: (woId) => {
        const woStore = useWorkOrderStore.getState()
        const wo = woStore.getWorkOrder(woId)
        if (!wo) return { ok: false, error: 'Work order not found' }

        const shipments = woStore.subcontractShipments.filter((s) => s.workOrderId === woId)
        const pendingBalance = shipments.reduce((s, sh) => s + shipmentBalance(sh), 0)
        if (pendingBalance > 0) {
          return { ok: false, error: `Cannot close — ${pendingBalance} qty still pending return` }
        }

        const pendingQc = useQualityStore.getState().inspections.some(
          (i) => i.workOrderId === woId && i.category === 'subcontract_return' && i.status === 'pending',
        )
        if (pendingQc) return { ok: false, error: 'Cannot close — QC pending on subcontract return' }

        const closeResult = woStore.closeWorkOrder(woId)
        if (!closeResult.ok) return closeResult

        const now = ts()
        set((s) => ({
          metaByWoId: {
            ...s.metaByWoId,
            [woId]: {
              workOrderId: woId,
              approvedAt: s.metaByWoId[woId]?.approvedAt ?? now,
              rate: s.metaByWoId[woId]?.rate ?? 0,
              closedAt: now,
            },
          },
        }))
        return { ok: true }
      },
    }),
    {
      name: 'vasant-erp-job-work-v1',
      storage: erpStorage,
      partialize: (s) => ({ metaByWoId: s.metaByWoId }),
    },
  ),
)
