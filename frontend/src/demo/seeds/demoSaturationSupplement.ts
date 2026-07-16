import { useDispatchStore } from '../../store/dispatchStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/** Clone connected dispatch / invoice / subcontract rows to meet saturation floors */
export function seedDemoSaturationSupplement(): void {
  topUpSubcontractWorkOrders()
  topUpDispatchChains()
}

function topUpSubcontractWorkOrders(): void {
  const ws = useWorkOrderStore.getState()
  const templates = ws.workOrders.filter((w) => w.woType === 'subcontract')
  if (templates.length === 0) return

  const sos = useMrpStore.getState().salesOrders.filter((s) => !['closed', 'cancelled'].includes(s.status))
  let n = 0
  while (ws.workOrders.filter((w) => w.woType === 'subcontract').length < SATURATION_TARGETS.jobWorkOrders) {
    const template = templates[n % templates.length]
    const so = sos[n % sos.length]
    if (!so) break
    const woNo = `JWO-SAT-${String(n + 1).padStart(3, '0')}`
    if (ws.workOrders.some((w) => w.woNo === woNo)) {
      n++
      continue
    }
    const woId = genId('wo')
    useWorkOrderStore.setState((s) => ({
      workOrders: [
        ...s.workOrders,
        {
          ...template,
          id: woId,
          woNo,
          salesOrderId: so.id,
          salesOrderNo: so.salesOrderNo,
          status: n % 3 === 0 ? 'in_production' : 'released',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }))
    n++
    if (n > 40) break
  }
}

function topUpDispatchChains(): void {
  const dispatchStore = useDispatchStore.getState()
  const templates = dispatchStore.dispatches.filter((d) => d.lines.length > 0)
  if (templates.length === 0) return

  const master = useMasterStore.getState()
  let n = 0
  while (useDispatchStore.getState().dispatches.length < SATURATION_TARGETS.dispatches) {
    const template = templates[n % templates.length]
    const dispatchNo = `DSP-SAT-${String(useDispatchStore.getState().dispatches.length + 1).padStart(4, '0')}`
    if (useDispatchStore.getState().dispatches.some((d) => d.dispatchNo === dispatchNo)) {
      n++
      continue
    }
    const id = genId('dsp')
    const so = useMrpStore.getState().getSalesOrder(template.salesOrderId)
    const customer = master.getCustomer(template.customerId)
    useDispatchStore.setState((s) => ({
      dispatches: [
        ...s.dispatches,
        {
          ...template,
          id,
          dispatchNo,
          status: 'delivered',
          lines: template.lines.map((line, idx) => ({ ...line, id: genId('dspl'), dispatchId: id, lineNo: idx + 1 })),
          customerName: customer?.customerName ?? template.customerName,
          salesOrderNo: so?.salesOrderNo ?? template.salesOrderNo,
          dispatchedAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
        },
      ],
    }))
    n++
    if (n > 50) break
  }

  const invoiceStore = useInvoiceStore.getState()
  let payIdx = invoiceStore.invoices.reduce((c, i) => c + i.payments.length, 0)
  for (const dsp of useDispatchStore.getState().dispatches) {
    if (invoiceStore.invoices.length >= SATURATION_TARGETS.invoices) break
    if (invoiceStore.invoices.some((i) => i.dispatchId === dsp.id)) continue
    if (!['delivered', 'dispatched', 'in_transit', 'pod_received', 'closed'].includes(dsp.status)) continue
    const created = useInvoiceStore.getState().createFromDispatch(dsp.id)
    if (created.ok && created.id) useInvoiceStore.getState().postInvoice(created.id)
  }

  for (const inv of useInvoiceStore.getState().invoices) {
    if (payIdx >= SATURATION_TARGETS.payments) break
    if (inv.payments.length > 0) {
      payIdx++
      continue
    }
    useInvoiceStore.getState().recordPayment(inv.id, {
      amount: inv.gst.grandTotal,
      paymentDate: new Date().toISOString().slice(0, 10),
      referenceNo: `SAT-SUP-${4000 + payIdx}`,
      mode: 'neft',
      remarks: 'Saturation supplement payment',
    })
    payIdx++
  }
}
