import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ComponentGenealogyResult,
  SerialNumberRecord,
  SerialStatus,
  SerialType,
  TrailerGenealogyResult,
  WarrantyInvestigationResult,
} from '../types/serialNumber'
import { SERIAL_TYPE_LABELS, SERIAL_STATUS_LABELS, SERIALIZED_ITEM_PREFIXES } from '../types/serialNumber'
import { assertPermission, getSessionUser } from '../utils/permissions'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { useQrStore } from './qrStore'
import { useQualityStore } from './qualityStore'
import { useWorkOrderStore } from './workOrderStore'
import { useDispatchStore } from './dispatchStore'
import { useInvoiceStore } from './invoiceStore'
import { useMasterStore } from './masterStore'
import { usePurchaseStore } from './purchaseStore'
import { memoizedOnSource } from './selectors/memoizedGetters'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

function normalizeSerialNo(serialNo: string) {
  return serialNo.trim().toUpperCase()
}

function inferSerialType(itemCode: string): SerialType | null {
  for (const rule of SERIALIZED_ITEM_PREFIXES) {
    if (rule.match.test(itemCode)) return rule.serialType
  }
  return null
}

function normalizeStatus(status: SerialStatus): SerialStatus {
  const map: Partial<Record<SerialStatus, SerialStatus>> = {
    registered: 'created',
    assigned: 'issued',
    in_production: 'in_wip',
    ready: 'in_stock',
    retired: 'closed',
  }
  return map[status] ?? status
}

interface SerialState {
  serials: SerialNumberRecord[]
  getSerial: (id: string) => SerialNumberRecord | undefined
  getBySerialNo: (serialNo: string) => SerialNumberRecord | undefined
  listSerials: (filters?: {
    serialType?: SerialType
    status?: SerialStatus
    workOrderId?: string
    customerId?: string
    grnId?: string
    itemId?: string
    vendorId?: string
  }) => SerialNumberRecord[]
  registerSerial: (input: {
    serialNo: string
    serialType: SerialType
    itemId?: string | null
    itemCode?: string | null
    productId?: string | null
    productCode?: string | null
    qrCode?: string | null
    workOrderId?: string | null
    woNo?: string | null
    salesOrderId?: string | null
    salesOrderNo?: string | null
    customerId?: string | null
    customerName?: string | null
    vendorId?: string | null
    vendorName?: string | null
    grnId?: string | null
    grnNo?: string | null
    batchLot?: string | null
    parentSerialId?: string | null
    installedTrailerNo?: string | null
    status?: SerialStatus
    createdBy?: string | null
  }) => { ok: boolean; error?: string; serialId?: string }
  registerGrnLineSerials: (grnId: string) => { ok: boolean; serialIds: string[] }
  assignToWorkOrder: (serialId: string, workOrderId: string, woNo: string) => { ok: boolean; error?: string }
  installOnTrailer: (componentSerialId: string, trailerSerialId: string, trailerNo: string) => { ok: boolean; error?: string }
  updateStatus: (serialId: string, status: SerialStatus) => void
  markDispatched: (trailerNo: string, chassisNo: string) => { ok: boolean; error?: string }
  validateUnique: (serialNo: string, serialType: SerialType, excludeId?: string) => { ok: boolean; error?: string }
  registerFgTrailer: (input: {
    trailerNo: string
    chassisNo: string
    workOrderId: string
    woNo: string
    salesOrderId?: string | null
    salesOrderNo?: string | null
    customerId?: string | null
    customerName?: string | null
    qrCode?: string | null
    componentSerialIds?: string[]
  }) => { ok: boolean; error?: string; trailerSerialId?: string }
  buildGenealogy: (query: string) => TrailerGenealogyResult
  buildComponentGenealogy: (serialNo: string) => ComponentGenealogyResult | null
  buildWarrantyInvestigation: (trailerNo: string) => WarrantyInvestigationResult | null
}

export const useSerialStore = create<SerialState>()(
  persist(
    (set, get) => ({
      serials: [],
      getSerial: (id) => get().serials.find((s) => s.id === id),
      getBySerialNo: (serialNo) => get().serials.find((s) => normalizeSerialNo(s.serialNo) === normalizeSerialNo(serialNo)),
      listSerials: (filters) => {
        const serials = get().serials
        const filterKey = JSON.stringify(filters ?? {})
        return memoizedOnSource(serials, `serial:list:${filterKey}`, () => {
          let rows = [...serials]
          if (filters?.serialType) rows = rows.filter((s) => s.serialType === filters.serialType)
          if (filters?.status) rows = rows.filter((s) => normalizeStatus(s.status) === normalizeStatus(filters.status!))
          if (filters?.workOrderId) rows = rows.filter((s) => s.workOrderId === filters.workOrderId)
          if (filters?.customerId) rows = rows.filter((s) => s.customerId === filters.customerId)
          if (filters?.grnId) rows = rows.filter((s) => s.grnId === filters.grnId)
          if (filters?.itemId) rows = rows.filter((s) => s.itemId === filters.itemId)
          if (filters?.vendorId) rows = rows.filter((s) => s.vendorId === filters.vendorId)
          return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        })
      },
      validateUnique: (serialNo, serialType, excludeId) => {
        const norm = normalizeSerialNo(serialNo)
        if (!norm) return { ok: false, error: 'Serial number is required' }
        const dup = get().serials.find((s) => {
          if (s.id === excludeId) return false
          if (normalizeSerialNo(s.serialNo) !== norm) return false
          if (serialType === 'finished_trailer' || serialType === 'chassis') {
            return s.serialType === 'finished_trailer' || s.serialType === 'chassis'
          }
          if (serialType === 'axle' || s.serialType === 'axle') return s.serialType === 'axle'
          return s.serialType === serialType
        })
        if (dup) return { ok: false, error: `Serial number ${norm} already registered (${dup.serialType})` }
        return { ok: true }
      },
      registerSerial: (input) => {
        const perm = assertPermission('masters', 'create')
        if (!perm.ok) return perm
        const unique = get().validateUnique(input.serialNo, input.serialType)
        if (!unique.ok) return unique
        const now = ts()
        const user = getSessionUser()
        const record: SerialNumberRecord = {
          id: genId('sn'),
          serialNo: normalizeSerialNo(input.serialNo),
          serialType: input.serialType,
          itemId: input.itemId ?? null,
          itemCode: input.itemCode ?? null,
          productId: input.productId ?? null,
          productCode: input.productCode ?? null,
          qrCode: input.qrCode ?? null,
          workOrderId: input.workOrderId ?? null,
          woNo: input.woNo ?? null,
          salesOrderId: input.salesOrderId ?? null,
          salesOrderNo: input.salesOrderNo ?? null,
          customerId: input.customerId ?? null,
          customerName: input.customerName ?? null,
          vendorId: input.vendorId ?? null,
          vendorName: input.vendorName ?? null,
          grnId: input.grnId ?? null,
          grnNo: input.grnNo ?? null,
          batchLot: input.batchLot ?? null,
          parentSerialId: input.parentSerialId ?? null,
          installedTrailerNo: input.installedTrailerNo ?? null,
          status: input.status ?? 'created',
          createdAt: now,
          createdBy: input.createdBy ?? user.name,
          updatedAt: now,
        }
        set((s) => ({ serials: [record, ...s.serials] }))
        return { ok: true, serialId: record.id }
      },
      registerGrnLineSerials: (grnId) => {
        const grn = usePurchaseStore.getState().getGrn(grnId)
        if (!grn) return { ok: false, serialIds: [] }
        const master = useMasterStore.getState()
        const vendor = master.vendors.find((v) => v.id === grn.vendorId)
        const serialIds: string[] = []
        for (const line of grn.lines) {
          const item = master.getItem(line.itemId)
          if (!item) continue
          const serialType = inferSerialType(item.itemCode)
          if (!serialType) continue
          const prefix = serialType === 'axle' ? 'AX' : item.itemCode.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'CMP'
          const serialNo = `${prefix}-${grn.grnNo.replace(/[^A-Z0-9]/gi, '')}-${line.id.slice(-4).toUpperCase()}`
          const result = get().registerSerial({
            serialNo,
            serialType,
            itemId: item.id,
            itemCode: item.itemCode,
            vendorId: grn.vendorId,
            vendorName: vendor?.vendorName ?? null,
            grnId: grn.id,
            grnNo: grn.grnNo,
            batchLot: `LOT-${grn.grnNo}`,
            status: 'in_stock',
          })
          if (result.ok && result.serialId) serialIds.push(result.serialId)
        }
        return { ok: true, serialIds }
      },
      assignToWorkOrder: (serialId, workOrderId, woNo) => {
        const serial = get().getSerial(serialId)
        if (!serial) return { ok: false, error: 'Serial not found' }
        if (serial.status === 'dispatched') return { ok: false, error: 'Cannot issue dispatched serial' }
        set((s) => ({
          serials: s.serials.map((r) =>
            r.id === serialId ? { ...r, workOrderId, woNo, status: 'issued' as SerialStatus, updatedAt: ts() } : r,
          ),
        }))
        return { ok: true }
      },
      installOnTrailer: (componentSerialId, trailerSerialId, trailerNo) => {
        const component = get().getSerial(componentSerialId)
        const trailer = get().getSerial(trailerSerialId)
        if (!component || !trailer) return { ok: false, error: 'Serial not found' }
        set((s) => ({
          serials: s.serials.map((r) =>
            r.id === componentSerialId
              ? {
                  ...r,
                  parentSerialId: trailerSerialId,
                  installedTrailerNo: trailerNo,
                  workOrderId: trailer.workOrderId,
                  woNo: trailer.woNo,
                  status: 'installed' as SerialStatus,
                  updatedAt: ts(),
                }
              : r,
          ),
        }))
        return { ok: true }
      },
      updateStatus: (serialId, status) => {
        set((s) => ({
          serials: s.serials.map((r) => (r.id === serialId ? { ...r, status, updatedAt: ts() } : r)),
        }))
      },
      markDispatched: (trailerNo, chassisNo) => {
        const t = get().getBySerialNo(trailerNo)
        const c = get().getBySerialNo(chassisNo)
        const now = ts()
        set((s) => ({
          serials: s.serials.map((r) => {
            const match =
              (t && r.id === t.id) ||
              (c && r.id === c.id) ||
              normalizeSerialNo(r.installedTrailerNo ?? '') === normalizeSerialNo(trailerNo)
            if (match && r.status !== 'closed') return { ...r, status: 'dispatched' as SerialStatus, updatedAt: now }
            return r
          }),
        }))
        return { ok: true }
      },
      registerFgTrailer: (input) => {
        const perm = assertPermission('production', 'post')
        if (!perm.ok) return perm
        const trailerCheck = get().validateUnique(input.trailerNo, 'finished_trailer')
        if (!trailerCheck.ok) return trailerCheck
        const chassisCheck = get().validateUnique(input.chassisNo, 'chassis')
        if (!chassisCheck.ok) return chassisCheck
        const trailer = get().registerSerial({
          serialNo: input.trailerNo,
          serialType: 'finished_trailer',
          qrCode: input.qrCode ?? null,
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          salesOrderId: input.salesOrderId,
          salesOrderNo: input.salesOrderNo,
          customerId: input.customerId,
          customerName: input.customerName,
          status: 'in_stock',
        })
        if (!trailer.ok || !trailer.serialId) return trailer
        const chassis = get().registerSerial({
          serialNo: input.chassisNo,
          serialType: 'chassis',
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          salesOrderId: input.salesOrderId,
          salesOrderNo: input.salesOrderNo,
          customerId: input.customerId,
          customerName: input.customerName,
          parentSerialId: trailer.serialId,
          status: 'in_stock',
        })
        if (!chassis.ok) return chassis
        for (const componentId of input.componentSerialIds ?? []) {
          get().installOnTrailer(componentId, trailer.serialId, input.trailerNo)
        }
        const woComponents = get().serials.filter(
          (s) =>
            s.workOrderId === input.workOrderId &&
            s.serialType !== 'finished_trailer' &&
            s.serialType !== 'chassis' &&
            !s.parentSerialId,
        )
        for (const comp of woComponents) get().installOnTrailer(comp.id, trailer.serialId, input.trailerNo)
        return { ok: true, trailerSerialId: trailer.serialId }
      },
      buildGenealogy: (query) => buildTrailerGenealogy(get, query),
      buildComponentGenealogy: (serialNo) => buildComponentGenealogyImpl(get, serialNo),
      buildWarrantyInvestigation: (trailerNo) => {
        const genealogy = get().buildGenealogy(trailerNo)
        if (!genealogy.trailerNo) return null
        return {
          trailerNo: genealogy.trailerNo,
          chassisNo: genealogy.chassisNo,
          customerName: genealogy.customerName,
          dispatchDate: genealogy.timeline.find((t) => t.kind === 'dispatch')?.date ?? null,
          invoiceNo: genealogy.timeline.find((t) => t.kind === 'invoice')?.refNo ?? null,
          components: genealogy.components,
          qcRecords: genealogy.timeline.filter((t) => t.kind === 'qc'),
          reworkRecords: genealogy.timeline.filter((t) => t.kind === 'rework'),
          ncrRecords: genealogy.timeline.filter((t) => t.kind === 'ncr'),
          vendorSources: genealogy.timeline.filter((t) => t.kind === 'vendor' || t.kind === 'grn'),
        }
      },
    }),
    { name: ERP_STORAGE_KEYS.serial, storage: erpStorage, version: ERP_PERSIST_VERSION },
  ),
)

function buildTrailerGenealogy(get: () => SerialState, query: string): TrailerGenealogyResult {
  const q = query.trim()
  const quality = useQualityStore.getState()
  const woStore = useWorkOrderStore.getState()
  const dispatch = useDispatchStore.getState()
  const invoice = useInvoiceStore.getState()
  const qrStore = useQrStore.getState()

  let serial =
    get().serials.find(
      (s) =>
        normalizeSerialNo(s.serialNo) === normalizeSerialNo(q) ||
        s.qrCode === q ||
        s.woNo === q ||
        (s.customerName && s.customerName.toLowerCase().includes(q.toLowerCase())),
    ) ?? null

  if (!serial) {
    const qr = qrStore.getByCode(q)
    if (qr) {
      serial =
        get().serials.find(
          (s) => s.qrCode === qr.qrCode || s.workOrderId === qr.entityId || s.serialNo === qr.displayCode,
        ) ?? null
    }
  }

  const wo =
    serial?.workOrderId ? woStore.getWorkOrder(serial.workOrderId) : woStore.workOrders.find((w) => w.woNo === q || w.id === q)

  const trailerSerial =
    serial?.serialType === 'finished_trailer'
      ? serial
      : get().serials.find(
          (s) =>
            s.serialType === 'finished_trailer' &&
            (s.workOrderId === wo?.id || normalizeSerialNo(s.serialNo) === normalizeSerialNo(q)),
        ) ?? null

  const timeline: TrailerGenealogyResult['timeline'] = []
  if (trailerSerial) {
    timeline.push({
      kind: 'serial',
      label: 'Finished Trailer',
      refId: trailerSerial.id,
      refNo: trailerSerial.serialNo,
      date: trailerSerial.createdAt,
      details: SERIAL_TYPE_LABELS[trailerSerial.serialType],
    })
  }

  const chassisSerial =
    serial?.serialType === 'chassis'
      ? serial
      : get().serials.find((s) => s.serialType === 'chassis' && (s.parentSerialId === trailerSerial?.id || s.workOrderId === wo?.id))

  if (chassisSerial) {
    timeline.push({
      kind: 'serial',
      label: 'Chassis',
      refId: chassisSerial.id,
      refNo: chassisSerial.serialNo,
      date: chassisSerial.createdAt,
      details: 'Chassis assembly',
    })
  }

  const components = get().serials.filter(
    (s) =>
      s.parentSerialId === trailerSerial?.id ||
      (trailerSerial && s.installedTrailerNo === trailerSerial.serialNo) ||
      (wo && s.workOrderId === wo.id && !['finished_trailer', 'chassis'].includes(s.serialType)),
  )

  for (const comp of components) {
    timeline.push({
      kind: 'component',
      label: SERIAL_TYPE_LABELS[comp.serialType],
      refId: comp.id,
      refNo: comp.serialNo,
      date: comp.updatedAt,
      details: comp.itemCode ? `${comp.itemCode} — ${comp.vendorName ?? 'internal'}` : comp.vendorName ?? '',
    })
    if (comp.grnNo) {
      timeline.push({
        kind: 'grn',
        label: 'GRN Receipt',
        refId: comp.grnId ?? comp.id,
        refNo: comp.grnNo,
        date: comp.createdAt,
        details: comp.vendorName ?? 'Vendor receipt',
      })
    }
    if (comp.vendorName) {
      timeline.push({
        kind: 'vendor',
        label: 'Vendor',
        refId: comp.vendorId ?? comp.id,
        refNo: comp.vendorName,
        date: comp.createdAt,
        details: comp.itemCode ?? '',
      })
    }
  }

  if (wo) {
    timeline.push({ kind: 'wo', label: 'Work Order', refId: wo.id, refNo: wo.woNo, date: wo.createdAt, details: wo.outputItemCode })
    for (const insp of quality.getInspectionsForWo(wo.id)) {
      timeline.push({
        kind: 'qc',
        label: insp.category === 'final' ? 'Final QC' : 'In-Process QC',
        refId: insp.id,
        refNo: insp.inspectionNo,
        date: insp.inspectionDate ?? insp.createdAt,
        details: `${insp.status} — ${insp.operationName ?? insp.inspectionType}`,
      })
    }
    for (const ncr of quality.ncrs.filter((n) => n.workOrderId === wo.id)) {
      timeline.push({ kind: 'ncr', label: 'NCR', refId: ncr.id, refNo: ncr.ncrNo, date: ncr.createdAt, details: ncr.defectDescription })
    }
    for (const rw of quality.reworks.filter((r) => r.workOrderId === wo.id)) {
      timeline.push({ kind: 'rework', label: 'Rework', refId: rw.id, refNo: rw.reworkNo, date: rw.createdAt, details: rw.status })
    }
  }

  const dispatches = dispatch.dispatches.filter(
    (d) =>
      d.lines.some(
        (l) =>
          normalizeSerialNo(l.trailerNo) === normalizeSerialNo(q) ||
          normalizeSerialNo(l.chassisNo) === normalizeSerialNo(q) ||
          (trailerSerial && l.workOrderId === trailerSerial.workOrderId),
      ) || (serial?.customerName && d.customerName.toLowerCase().includes(serial.customerName.toLowerCase())),
  )

  for (const d of dispatches) {
    timeline.push({ kind: 'dispatch', label: 'Dispatch', refId: d.id, refNo: d.dispatchNo, date: d.dispatchDate ?? d.plannedDate, details: d.status })
    const inv = invoice.invoices.find((i) => i.dispatchId === d.id)
    if (inv) {
      timeline.push({ kind: 'invoice', label: 'Invoice', refId: inv.id, refNo: inv.invoiceNo, date: inv.invoiceDate, details: `₹${inv.gst.grandTotal}` })
    }
  }

  timeline.sort((a, b) => a.date.localeCompare(b.date))

  return {
    serial: serial ?? trailerSerial,
    trailerNo: trailerSerial?.serialNo ?? dispatches[0]?.lines[0]?.trailerNo ?? null,
    chassisNo: chassisSerial?.serialNo ?? dispatches[0]?.lines[0]?.chassisNo ?? null,
    qrCode: trailerSerial?.qrCode ?? serial?.qrCode ?? q,
    woNo: serial?.woNo ?? wo?.woNo ?? null,
    salesOrderNo: serial?.salesOrderNo ?? wo?.salesOrderNo ?? dispatches[0]?.salesOrderNo ?? null,
    customerName: serial?.customerName ?? trailerSerial?.customerName ?? dispatches[0]?.customerName ?? null,
    components,
    timeline,
  }
}

function buildComponentGenealogyImpl(get: () => SerialState, serialNo: string): ComponentGenealogyResult | null {
  const serial = get().getBySerialNo(serialNo)
  if (!serial) return null
  const timeline: ComponentGenealogyResult['timeline'] = []

  if (serial.vendorName) {
    timeline.push({ kind: 'vendor', label: 'Vendor', refId: serial.vendorId ?? serial.id, refNo: serial.vendorName, date: serial.createdAt, details: serial.itemCode ?? '' })
  }
  if (serial.grnNo) {
    timeline.push({ kind: 'grn', label: 'GRN', refId: serial.grnId ?? serial.id, refNo: serial.grnNo, date: serial.createdAt, details: 'Incoming receipt' })
    const incoming = useQualityStore.getState().inspections.find((i) => i.grnId === serial.grnId)
    if (incoming) {
      timeline.push({
        kind: 'qc',
        label: 'Incoming QC',
        refId: incoming.id,
        refNo: incoming.inspectionNo,
        date: incoming.inspectionDate ?? incoming.createdAt,
        details: incoming.result ?? incoming.status,
      })
    }
  }
  if (serial.woNo) {
    timeline.push({
      kind: 'wo',
      label: 'Issued to WO',
      refId: serial.workOrderId ?? serial.id,
      refNo: serial.woNo,
      date: serial.updatedAt,
      details: `Status: ${SERIAL_STATUS_LABELS[normalizeStatus(serial.status)]}`,
    })
  }
  if (serial.installedTrailerNo) {
    timeline.push({
      kind: 'serial',
      label: 'Installed in Trailer',
      refId: serial.parentSerialId ?? serial.id,
      refNo: serial.installedTrailerNo,
      date: serial.updatedAt,
      details: 'Component installed',
    })
    const trailerGenealogy = buildTrailerGenealogy(get, serial.installedTrailerNo)
    const dispatchNode = trailerGenealogy.timeline.find((t) => t.kind === 'dispatch')
    const invoiceNode = trailerGenealogy.timeline.find((t) => t.kind === 'invoice')
    if (dispatchNode) timeline.push(dispatchNode)
    if (invoiceNode) timeline.push(invoiceNode)
  }

  timeline.sort((a, b) => a.date.localeCompare(b.date))
  return {
    serial,
    timeline,
    installedTrailerNo: serial.installedTrailerNo,
    customerName: serial.customerName ?? buildTrailerGenealogy(get, serial.installedTrailerNo ?? '').customerName,
  }
}

export function assertSerialDispatchReady(trailerNo: string, chassisNo: string): { ok: boolean; error?: string } {
  if (!trailerNo.trim()) return { ok: false, error: 'Trailer serial number required before dispatch' }
  if (!chassisNo.trim()) return { ok: false, error: 'Chassis number required before dispatch' }
  const store = useSerialStore.getState()
  const dupTrailer = store.getBySerialNo(trailerNo)
  const dupChassis = store.getBySerialNo(chassisNo)
  if (dupTrailer?.status === 'dispatched') return { ok: false, error: `Trailer serial ${trailerNo} already dispatched — cannot reuse` }
  if (dupChassis?.status === 'dispatched') return { ok: false, error: `Chassis number ${chassisNo} already dispatched — cannot reuse` }
  return { ok: true }
}
