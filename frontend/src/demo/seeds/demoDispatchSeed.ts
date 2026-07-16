import { runSaturationDispatchExpansion, createDispatchInvoicePayment, processFgWoToDispatchReady } from '../demoBulkSeed'
import { useDispatchStore } from '../../store/dispatchStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Complete dispatch → invoice → payment chains to saturation targets */
export function seedDemoDispatch(): void {
  let pushed = 0
  for (const fgWo of useWorkOrderStore.getState().workOrders.filter(
    (w) => w.woType === 'finished_goods' && !['closed', 'fg_received', 'cancelled'].includes(w.status),
  )) {
    if (pushed >= 20) break
    try {
      processFgWoToDispatchReady(fgWo.id)
      pushed++
    } catch {
      /* best-effort FG completion for dispatch saturation */
    }
  }

  runSaturationDispatchExpansion()

  let chainIdx = 500
  for (const fgWo of useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'finished_goods' && w.status === 'fg_received')) {
    if (useDispatchStore.getState().dispatches.length >= SATURATION_TARGETS.dispatches) break
    if (useDispatchStore.getState().dispatches.some((d) => d.lines.some((l) => l.workOrderId === fgWo.id))) continue
    createDispatchInvoicePayment(fgWo.id, chainIdx++)
  }

  while (useDispatchStore.getState().dispatches.length < SATURATION_TARGETS.dispatches) {
    const dispatchStore = useDispatchStore.getState()
    const candidates = dispatchStore.getReadyCandidates()
    if (candidates.length === 0) break
    const c = candidates[0]
    if (dispatchStore.dispatches.some((d) => d.lines.some((l) => l.workOrderId === c.workOrderId))) break
    createDispatchInvoicePayment(c.workOrderId, chainIdx++)
    chainIdx++
    if (chainIdx > 650) break
  }
}

export function seedDemoFinance(): void {
  const dispatchStore = useDispatchStore.getState()
  const invoiceStore = useInvoiceStore.getState()
  let payIdx = 0

  for (const dsp of dispatchStore.dispatches) {
    if (invoiceStore.invoices.length >= SATURATION_TARGETS.invoices) break
    if (!['delivered', 'in_transit', 'dispatched', 'closed', 'pod_received'].includes(dsp.status)) continue
    if (invoiceStore.invoices.some((inv) => inv.dispatchId === dsp.id)) continue
    const invCreate = invoiceStore.createFromDispatch(dsp.id)
    if (invCreate.ok && invCreate.id) invoiceStore.postInvoice(invCreate.id)
  }

  for (const inv of useInvoiceStore.getState().invoices) {
    if (payIdx >= SATURATION_TARGETS.payments) break
    if (inv.payments.length > 0) {
      payIdx++
      continue
    }
    useInvoiceStore.getState().recordPayment(inv.id, {
      amount: payIdx % 4 === 0 ? Math.round(inv.gst.grandTotal * 0.5) : inv.gst.grandTotal,
      paymentDate: new Date().toISOString().slice(0, 10),
      referenceNo: `SAT-UTR-${3000 + payIdx}`,
      mode: 'neft',
      remarks: 'Demo saturation payment',
    })
    payIdx++
  }
}
