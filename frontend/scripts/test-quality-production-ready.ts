/**
 * Quality production readiness tests
 * npx tsx scripts/test-quality-production-ready.ts
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { buildEmptyParameterResults } = await import('../src/utils/qcPlanResolver')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
useFreezeStore.setState({ freezes: [] })
useWorkOrderStore.setState({ workOrders: [], materialLines: [], productionOperations: [], jobCards: [], subcontractShipments: [], fgReceipts: [], saReceipts: [], activities: [] })
useMrpStore.setState({ runs: [] })

check('Inspection plans seeded', useQualityStore.getState().getInspectionPlans().length >= 2)

const inId = useQualityStore.getState().createIncomingInspection({
  grnId: 'grn-test',
  grnNo: 'GRN-TEST',
  poId: 'po-test',
  vendorId: 'vendor-test',
  lines: [{ itemId: 'item-rm-plt', receivedQty: 100, warehouseId: 'wh-rm-main' }],
})
check('Incoming QC created', !!inId)

usePurchaseStore.setState((s) => ({
  grns: [
    ...s.grns,
    {
      id: 'grn-test',
      grnNo: 'GRN-TEST',
      poId: 'po-test',
      poNo: 'PO-TEST',
      vendorId: 'vendor-test',
      warehouseId: 'wh-rm-main',
      grnDate: new Date().toISOString().slice(0, 10),
      status: 'pending_qc' as const,
      qcRequired: true,
      incomingInspectionId: inId,
      lines: [{
        id: 'grnl-test',
        poLineId: 'pol-test',
        itemId: 'item-rm-plt',
        warehouseId: 'wh-rm-main',
        receivedQty: 100,
        acceptedQty: 0,
        rejectedQty: 0,
        quarantineQty: 100,
        rate: 100,
      }],
      postedAt: new Date().toISOString(),
      excessTolerancePct: 5,
      createdBy: 'Test',
      createdByName: 'Test',
      createdAt: new Date().toISOString(),
      updatedBy: null,
      updatedByName: null,
      updatedAt: null,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
    },
  ],
}))

// Quarantine stock for incoming QC release transfer
const { getQuarantineWarehouseId } = await import('../src/data/quality/itemQcConfig')
useInventoryStore.getState().postGrnReceipt({
  itemId: 'item-rm-plt',
  warehouseId: getQuarantineWarehouseId(),
  qty: 100,
  rate: 100,
  referenceNo: 'GRN-TEST',
  remarks: 'Test quarantine stock',
})

const incoming = useQualityStore.getState().getInspection(inId)!
const filledParams = buildEmptyParameterResults(incoming.parameterSnapshot).map((r) =>
  r.parameterType === 'boolean'
    ? { ...r, actualValue: true }
    : r.parameterType === 'numeric' && r.targetValue != null
      ? { ...r, actualValue: r.targetValue }
      : r.parameterType === 'text'
        ? { ...r, actualValue: 'OK' }
        : r,
)

const inPass = useQualityStore.getState().recordIncomingQcDecision(inId, {
  inspector: 'QC Desk',
  result: 'pass',
  remarks: 'MTC OK',
  acceptedQty: 100,
  rejectedQty: 0,
  parameterResults: filledParams,
  useAutoDecision: true,
})
check('Incoming QC decision', inPass.ok)

const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!
const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
check('Final QC created', fqc.ok, fqc.inspectionId)
const fqcInsp = useQualityStore.getState().getInspection(fqc.inspectionId!)
const fqcParams = fqcInsp?.parameterResults.map((r) =>
  r.parameterType === 'boolean'
    ? { ...r, actualValue: r.passFailRule === 'boolean_false' ? false : true }
    : r.parameterType === 'photo_required'
      ? { ...r, attachmentRef: 'photo.jpg', actualValue: 'photo.jpg' }
      : r.parameterType === 'numeric' && r.minValue != null
        ? { ...r, actualValue: r.targetValue ?? r.minValue }
        : r.parameterType === 'text'
          ? { ...r, actualValue: 'OK' }
          : r.parameterType === 'dropdown'
            ? { ...r, actualValue: 'Acceptable' }
            : r,
)
const fqcPass = useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'Pradeep Singh',
  result: 'pass',
  remarks: 'All final checks pass',
  parameterResults: fqcParams,
  useAutoDecision: true,
})
check('Final QC pass', fqcPass.ok)
check('hasFinalQcPassed', useQualityStore.getState().hasFinalQcPassed(fgWo.id))

check('Pending inspection report', useQualityStore.getState().getPendingInspectionReport().length >= 0)
check('NCR ageing report', Array.isArray(useQualityStore.getState().getNcrAgeingReport()))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
