/**
 * Invoice, GST, receivable, payment status
 * npx tsx scripts/test-invoice.ts
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(key: string) {
    return mem.get(key) ?? null
  },
  setItem(key: string, value: string) {
    mem.set(key, value)
  },
  removeItem(key: string) {
    mem.delete(key)
  },
  key() {
    return null
  },
}

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useFreezeStore } = await import('../src/store/freezeStore')
const { computeGst } = await import('../src/utils/gstEngine')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

function reset() {
  useInventoryStore.setState({
    stockMovements: [...seedStockMovements],
    reservations: seedReservations.map((r) => ({ ...r })),
  })
  useMrpStore.setState({ runs: [], salesOrders: seedSalesOrders.map((s) => ({ ...s })) })
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
  useDispatchStore.setState({ dispatches: [] })
  useInvoiceStore.setState({ invoices: [] })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  useFreezeStore.setState({ freezes: [] })
}

function ensureLineStock(itemId: string, warehouseId: string, qty: number) {
  const free = useInventoryStore.getState().getFreeQty(itemId, warehouseId)
  if (free < qty) {
    useInventoryStore.getState().postInward({
      itemId,
      warehouseId,
      qty: qty - free + 10,
      referenceNo: 'TEST-INV-INW',
      remarks: 'Test inward',
    })
  }
}

function markFgReadyForDispatch(fgWoId: string) {
  const store = useWorkOrderStore.getState()
  const fgWo = store.getWorkOrder(fgWoId)!
  const master = useMasterStore.getState()
  const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')!
  useInventoryStore.getState().postFgReceipt({
    itemId: fgWo.fgItemId,
    warehouseId: fgWh.id,
    qty: fgWo.qty,
    referenceNo: fgWo.woNo,
    remarks: 'Invoice test FG',
    workOrderId: fgWo.id,
  })
  useWorkOrderStore.setState((s) => ({
    workOrders: s.workOrders.map((w) => (w.id === fgWoId ? { ...w, status: 'fg_received' as const } : w)),
  }))
}

console.log('=== Invoice Module ===\n')

// GST engine
const intraGst = computeGst(100000, 'Maharashtra', 18)
check('Intra-state CGST+SGST', intraGst.scheme === 'cgst_sgst' && intraGst.cgstAmount === 9000)
check('Intra-state grand total', intraGst.grandTotal === 118000)

const interGst = computeGst(100000, 'Gujarat', 18)
check('Inter-state IGST', interGst.scheme === 'igst' && interGst.igstAmount === 18000)

reset()
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrp = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
const woCreate = useWorkOrderStore.getState().createFromMrpRun(mrp.runId!, so.id)
check('WO created for invoice test', woCreate.ok, woCreate.error)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')!

markFgReadyForDispatch(fgWo.id)
check('FG WO status after prepare', useWorkOrderStore.getState().getWorkOrder(fgWo.id)!.status === 'fg_received')

const fqc = useQualityStore.getState().createFinalInspection(fgWo.id)
check('Final QC created for dispatch', fqc.ok, fqc.error)
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
useQualityStore.getState().recordFinalQcDecision(fqc.inspectionId!, {
  inspector: 'Test QC',
  result: 'pass',
  remarks: 'Invoice test final QC',
  parameterResults: fqcParams,
  useAutoDecision: true,
})

const candidates = useDispatchStore.getState().getReadyCandidates()
const candidate = candidates.find((c) => c.workOrderId === fgWo.id)
check('Dispatch candidate ready', Boolean(candidate), `count=${candidates.length}`)
if (!candidate) {
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(1)
}

const plan = useDispatchStore.getState().createDispatchPlan(candidate)
check('Create dispatch plan', plan.ok, plan.error)
const dispatchId = plan.id!

useDispatchStore.getState().updateLogistics(dispatchId, {
  vehicleNo: 'MH-12-XX-0001',
  lrNo: 'LR-INV-001',
  transporter: 'Test Logistics',
  driverName: 'Driver',
  driverPhone: '9999999999',
})
for (const item of useDispatchStore.getState().getDispatch(dispatchId)!.checklist) {
  useDispatchStore.getState().toggleChecklistItem(dispatchId, item.id, true)
}
useDispatchStore.getState().addPhoto(dispatchId, 'Load', 'data:image/png;base64,abc')
check('Security gate approval', useDispatchStore.getState().approveSecurityGate(dispatchId).ok)
const confirm = useDispatchStore.getState().confirmDispatch(dispatchId)
check('Confirm dispatch', confirm.ok, confirm.error)

const create = useInvoiceStore.getState().createFromDispatch(dispatchId)
check('Create invoice from dispatch', create.ok, create.error)
const invoice = useInvoiceStore.getState().getInvoice(create.id!)!
check('Invoice is draft', invoice.status === 'draft')
check('GST computed on invoice', invoice.gst.grandTotal > invoice.gst.taxableAmount)
check('Maharashtra customer → CGST/SGST', invoice.gst.scheme === 'cgst_sgst')

const post = useInvoiceStore.getState().postInvoice(invoice.id)
check('Post invoice', post.ok)
check('SO status invoiced', useMrpStore.getState().getSalesOrder(so.id)!.status === 'invoiced')

const receivables = useInvoiceStore.getState().getReceivables()
check('Receivable row exists', receivables.some((r) => r.invoiceId === invoice.id))
check('Payment status unpaid', receivables.find((r) => r.invoiceId === invoice.id)!.paymentStatus === 'unpaid')

const pay = useInvoiceStore.getState().recordPayment(invoice.id, {
  amount: invoice.gst.grandTotal,
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNo: 'UTR-TEST-001',
  mode: 'neft',
})
check('Full payment recorded', pay.ok)
check('Payment status paid', useInvoiceStore.getState().getInvoice(invoice.id)!.paymentStatus === 'paid')
check('SO closed after payment', useMrpStore.getState().getSalesOrder(so.id)!.status === 'closed')
check('Balance due zero', useInvoiceStore.getState().getInvoice(invoice.id)!.balanceDue === 0)
check('Trailer numbers on invoice lines', invoice.lines.every((l) => l.trailerNo && l.chassisNo))
check('LR number from dispatch', useInvoiceStore.getState().getInvoice(invoice.id)!.lrNo === 'LR-INV-001')

const { amountInWords } = await import('../src/utils/amountInWords')
check('Amount in words', amountInWords(118000).includes('Rupees'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
