import { resolveQrScan, getAllowedActions } from './qrEngine'
import { useBarcodeStore } from '../store/barcodeStore'
import { useMasterStore } from '../store/masterStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useSerialStore } from '../store/serialStore'
import { QR_ENTITY_LABELS } from '../types/qrTraceability'

export type MobileScanEntityType =
  | 'item'
  | 'material_lot'
  | 'grn'
  | 'po'
  | 'work_order'
  | 'job_card'
  | 'job_work_order'
  | 'trailer_serial'
  | 'dispatch'
  | 'invoice'
  | 'unknown'

export interface MobileScanPreview {
  code: string
  entityType: MobileScanEntityType
  entityTypeLabel: string
  documentNo: string
  status: string
  location?: string
  subtitle?: string
  entityId?: string
  allowedActions: string[]
  mobileRoutes: { label: string; path: string }[]
}

function routesForType(type: MobileScanEntityType, entityId?: string): MobileScanPreview['mobileRoutes'] {
  switch (type) {
    case 'grn':
      return [{ label: 'Receive GRN', path: entityId ? `/m/grn/${entityId}` : '/m/grn' }]
    case 'po':
      return [{ label: 'Mobile GRN', path: '/m/grn' }]
    case 'work_order':
      return [
        { label: 'Material Issue', path: '/m/material-issue' },
        { label: 'Job Cards', path: '/m/shop-floor' },
      ]
    case 'job_card':
      return entityId ? [{ label: 'Job Card', path: `/m/job-card/${entityId}` }] : [{ label: 'Shop Floor', path: '/m/shop-floor' }]
    case 'job_work_order':
      return [
        { label: 'Job Work Send', path: entityId ? `/m/job-work-send/${entityId}` : '/m/job-work' },
        { label: 'Job Work Receive', path: entityId ? `/m/job-work-receive/${entityId}` : '/m/job-work' },
      ]
    case 'dispatch':
      return entityId ? [{ label: 'Dispatch Loading', path: `/m/dispatch/${entityId}` }] : [{ label: 'Dispatch', path: '/m/dispatch' }]
    case 'trailer_serial':
      return [{ label: 'Dispatch Scan', path: '/m/dispatch' }, { label: 'Genealogy', path: '/genealogy' }]
    case 'material_lot':
      return [
        { label: 'Material Issue', path: '/m/material-issue' },
        { label: 'QC', path: '/m/qc' },
      ]
    default:
      return [{ label: 'Scan Again', path: '/m/scan' }]
  }
}

export function resolveMobileScan(code: string): { ok: true; preview: MobileScanPreview } | { ok: false; error: string } {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, error: 'Enter or scan a code' }

  const qr = resolveQrScan(trimmed)
  if (qr.ok) {
    const r = qr.record
    const typeMap: Partial<Record<string, MobileScanEntityType>> = {
      MATERIAL_LOT: 'material_lot',
      WORK_ORDER: 'work_order',
      JOB_CARD: 'job_card',
      JOB_WORK_ORDER: 'job_work_order',
      FINISHED_TRAILER: 'trailer_serial',
      DISPATCH: 'dispatch',
      SUB_ASSEMBLY: 'material_lot',
    }
    const entityType = typeMap[r.entityType] ?? 'unknown'
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType,
        entityTypeLabel: QR_ENTITY_LABELS[r.entityType] ?? r.entityType,
        documentNo: r.displayCode,
        status: r.status ?? 'active',
        location: r.metadata.warehouseId,
        subtitle: r.entityType,
        entityId: r.entityId,
        allowedActions: getAllowedActions(r),
        mobileRoutes: routesForType(entityType, r.entityId),
      },
    }
  }

  const po = usePurchaseStore.getState().purchaseOrders.find(
    (p) => p.poNo.toUpperCase() === trimmed.toUpperCase() || p.id === trimmed,
  )
  if (po) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'po',
        entityTypeLabel: 'Purchase Order',
        documentNo: po.poNo,
        status: po.status,
        subtitle: useMasterStore.getState().getVendor(po.vendorId)?.vendorName,
        entityId: po.id,
        allowedActions: ['Receive GRN'],
        mobileRoutes: routesForType('po', po.id),
      },
    }
  }

  const grn = usePurchaseStore.getState().grns.find(
    (g) => g.grnNo.toUpperCase() === trimmed.toUpperCase() || g.id === trimmed,
  )
  if (grn) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'grn',
        entityTypeLabel: 'GRN',
        documentNo: grn.grnNo,
        status: grn.status,
        entityId: grn.id,
        allowedActions: ['View GRN', 'Receive'],
        mobileRoutes: routesForType('grn', grn.id),
      },
    }
  }

  const wo = useWorkOrderStore.getState().workOrders.find(
    (w) => w.woNo.toUpperCase() === trimmed.toUpperCase() || w.id === trimmed,
  )
  if (wo) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: wo.woType === 'subcontract' ? 'job_work_order' : 'work_order',
        entityTypeLabel: wo.woType === 'subcontract' ? 'Job Work Order' : 'Work Order',
        documentNo: wo.woNo,
        status: wo.status,
        entityId: wo.id,
        allowedActions: ['Issue Material', 'Open Job Cards'],
        mobileRoutes: routesForType(wo.woType === 'subcontract' ? 'job_work_order' : 'work_order', wo.id),
      },
    }
  }

  const jc = useWorkOrderStore.getState().jobCards.find(
    (j) => j.jobCardNo.toUpperCase() === trimmed.toUpperCase() || j.id === trimmed,
  )
  if (jc) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'job_card',
        entityTypeLabel: 'Job Card',
        documentNo: jc.jobCardNo,
        status: jc.status,
        entityId: jc.id,
        allowedActions: ['Start', 'Complete', 'Daily Entry'],
        mobileRoutes: routesForType('job_card', jc.id),
      },
    }
  }

  const dsp = useDispatchStore.getState().dispatches.find(
    (d) => d.dispatchNo.toUpperCase() === trimmed.toUpperCase() || d.id === trimmed,
  )
  if (dsp) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'dispatch',
        entityTypeLabel: 'Dispatch',
        documentNo: dsp.dispatchNo,
        status: dsp.status,
        entityId: dsp.id,
        allowedActions: ['Loading', 'Gate Pass'],
        mobileRoutes: routesForType('dispatch', dsp.id),
      },
    }
  }

  const item = useMasterStore.getState().items.find(
    (i) => i.itemCode.toUpperCase() === trimmed.toUpperCase() || i.id === trimmed,
  )
  if (item) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'item',
        entityTypeLabel: 'Item',
        documentNo: item.itemCode,
        status: item.isActive ? 'active' : 'inactive',
        subtitle: item.itemName,
        entityId: item.id,
        allowedActions: ['Issue', 'Count Stock', 'Transfer'],
        mobileRoutes: [
          { label: 'Material Issue', path: '/m/material-issue' },
          { label: 'Stock Count', path: '/m/stock-count' },
        ],
      },
    }
  }

  const bc = useBarcodeStore.getState().getByValue(trimmed)
  if (bc) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'material_lot',
        entityTypeLabel: 'Barcode / Lot',
        documentNo: bc.barcodeValue,
        status: bc.status,
        subtitle: bc.entityLabel,
        entityId: bc.entityId,
        allowedActions: ['Receive', 'Issue', 'Transfer'],
        mobileRoutes: routesForType('material_lot', bc.entityId),
      },
    }
  }

  const serial = useSerialStore.getState().serials.find(
    (s) => s.serialNo.toUpperCase() === trimmed.toUpperCase(),
  )
  if (serial) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'trailer_serial',
        entityTypeLabel: 'Serial / Trailer',
        documentNo: serial.serialNo,
        status: serial.status ?? 'active',
        entityId: serial.id,
        allowedActions: ['Dispatch Scan', 'Genealogy'],
        mobileRoutes: routesForType('trailer_serial', serial.id),
      },
    }
  }

  const inv = useInvoiceStore.getState().invoices.find(
    (i) => i.invoiceNo.toUpperCase() === trimmed.toUpperCase(),
  )
  if (inv) {
    return {
      ok: true,
      preview: {
        code: trimmed,
        entityType: 'invoice',
        entityTypeLabel: 'Invoice',
        documentNo: inv.invoiceNo,
        status: inv.status,
        entityId: inv.id,
        allowedActions: ['View'],
        mobileRoutes: [],
      },
    }
  }

  return { ok: false, error: `Unknown code: ${trimmed}` }
}
