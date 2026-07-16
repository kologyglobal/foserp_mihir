import { useMemo } from 'react'
import type { QcInspection } from '../../types/quality'
import { useQrStore } from '../../store/qrStore'
import { EntityQrToolbar } from './EntityQrToolbar'

export function InspectionQrSection({ inspection }: { inspection: QcInspection }) {
  const records = useQrStore((s) => s.records)

  const props = useMemo(() => {
    if (inspection.category === 'final' && inspection.workOrderId) {
      const trailer = records.find(
        (r) => r.entityType === 'FINISHED_TRAILER' && r.entityId === inspection.workOrderId,
      )
      return {
        entityType: 'FINISHED_TRAILER' as const,
        entityId: inspection.workOrderId,
        displayCode: trailer?.displayCode ?? inspection.woNo ?? inspection.workOrderId,
        metadata: { woId: inspection.workOrderId, woNo: inspection.woNo ?? undefined },
      }
    }
    if (inspection.subcontractShipmentId) {
      const jw = records.find(
        (r) => r.entityType === 'JOB_WORK_ORDER' && r.entityId === inspection.subcontractShipmentId,
      )
      return {
        entityType: 'JOB_WORK_ORDER' as const,
        entityId: inspection.subcontractShipmentId,
        displayCode: jw?.displayCode ?? inspection.subcontractShipmentId,
        metadata: { shipmentId: inspection.subcontractShipmentId, woNo: inspection.woNo ?? undefined },
      }
    }
    if (inspection.jobCardId) {
      const jc = records.find((r) => r.entityType === 'JOB_CARD' && r.entityId === inspection.jobCardId)
      return {
        entityType: 'JOB_CARD' as const,
        entityId: inspection.jobCardId,
        displayCode: jc?.displayCode ?? inspection.jobCardId,
        metadata: { jobCardId: inspection.jobCardId, woNo: inspection.woNo ?? undefined },
      }
    }
    if (inspection.grnId) {
      const lot = records.find(
        (r) => r.entityType === 'MATERIAL_LOT' && r.metadata.grnId === inspection.grnId,
      )
      if (lot) {
        return {
          entityType: 'MATERIAL_LOT' as const,
          entityId: lot.entityId,
          displayCode: lot.displayCode,
          metadata: { grnId: inspection.grnId, grnNo: inspection.grnNo ?? undefined },
        }
      }
    }
    if (inspection.workOrderId) {
      return {
        entityType: 'WORK_ORDER' as const,
        entityId: inspection.workOrderId,
        displayCode: inspection.woNo ?? inspection.workOrderId,
        metadata: { woId: inspection.workOrderId, woNo: inspection.woNo ?? undefined },
      }
    }
    return null
  }, [inspection, records])

  if (!props) return null
  return (
    <div className="mb-4 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">QR Traceability</p>
      <EntityQrToolbar {...props} />
    </div>
  )
}
