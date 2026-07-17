import type { JobWorkOrder } from '@/types/manufacturingJobWork'
import type { ProductionPlan } from '@/types/manufacturing'
import type { WorkOrder, WorkOrderMaterial } from '@/types/manufacturingWorkOrder'
import { getWorkOrderListStatus } from '@/types/manufacturingWorkOrder'

/** Short guiding tips — not a chatbot. */

export function buildDashboardAiInsights(input: {
  delayedCount: number
  shortageItemCount: number
  qcPendingCount: number
  qcPendingQty?: number
}): string[] {
  const tips: string[] = []
  if (input.delayedCount > 0) {
    tips.push(`${input.delayedCount} work order${input.delayedCount === 1 ? '' : 's'} ${input.delayedCount === 1 ? 'is' : 'are'} delayed.`)
  }
  if (input.shortageItemCount > 0) {
    tips.push(`${input.shortageItemCount} item${input.shortageItemCount === 1 ? '' : 's'} have material shortage.`)
  }
  if (input.qcPendingCount > 0) {
    tips.push(
      input.qcPendingQty && input.qcPendingQty > 0
        ? `QC pending quantity increased today (${input.qcPendingQty} units awaiting review).`
        : 'QC pending quantity increased today.',
    )
  }
  if (!tips.length) {
    tips.push('Shopfloor looks balanced. Review today’s plan and start ready work orders.')
  }
  return tips
}

export function buildWorkOrderAiInsights(
  wo: WorkOrder,
  materials: WorkOrderMaterial[] = [],
): string[] {
  const tips: string[] = []
  const listStatus = getWorkOrderListStatus(wo)
  const shortLines = materials.filter((m) => m.shortageQty > 0)

  if (listStatus === 'ready' || (wo.status === 'draft' && (wo.materialStatus === 'available' || wo.materialStatus === 'reserved'))) {
    tips.push('This WO can start because all materials are available.')
  }

  for (const m of shortLines.slice(0, 2)) {
    tips.push(`Raw material ${m.componentItemCode} is short by ${m.shortageQty} ${m.uom}.`)
  }

  if (wo.qualityRequired) {
    tips.push('QC is required for this finished item.')
  }

  if (wo.consumptionMode === 'automatic' && materials.length > 0) {
    tips.push(`Auto consumption will consume ${materials.length} material${materials.length === 1 ? '' : 's'} on completion.`)
  }

  if (listStatus === 'in_progress') {
    tips.push('Enter good quantity and Complete Production on this screen.')
  }
  if (listStatus === 'on_hold') {
    tips.push('Clear the hold reason, then Resume production.')
  }
  if (listStatus === 'qc_pending' || listStatus === 'qc_hold') {
    tips.push('Open QC Action to Accept, Reject, or Send to Rework.')
  }
  if (listStatus === 'completed' && !wo.qualityHold) {
    tips.push('Review quantities and Close this work order.')
  }

  if (!tips.length) {
    tips.push('Check materials, then follow the stepper actions for this status.')
  }
  return tips
}

export function buildProductionPlanAiInsights(plan: ProductionPlan): string[] {
  const lines = plan.lines.filter((l) => !l.ignored)
  const tips: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const dueThisWeek = lines.filter(
    (l) => !l.woCreated && l.requiredProductionQuantity > 0 && l.requiredDate >= today && l.requiredDate <= weekEndStr,
  )
  if (dueThisWeek.length) {
    tips.push('Create WOs for items due this week.')
  }

  const noBom = lines.filter((l) => l.bomStatus === 'inactive' || l.bomStatus === 'missing' || l.bomStatus === 'draft')
  if (noBom.length) {
    tips.push(`This plan has ${noBom.length} item${noBom.length === 1 ? '' : 's'} without active BOM.`)
  }

  const prioritize = [...lines]
    .filter((l) => !l.woCreated && l.requiredProductionQuantity > 0)
    .sort((a, b) => a.requiredDate.localeCompare(b.requiredDate))[0]
  if (prioritize) {
    tips.push(
      `Prioritize ${prioritize.finishedItemName} because sales order due date is near.`,
    )
  }

  const shortage = lines.filter((l) => l.materialStatus === 'shortage').length
  if (shortage) {
    tips.push(`${shortage} item${shortage === 1 ? '' : 's'} have material shortage — fix stock before generating WOs.`)
  }

  if (!tips.length) {
    tips.push('Plan looks balanced — generate work orders when ready.')
  }
  return tips
}

export function buildJobWorkAiInsights(orders: JobWorkOrder[]): string[] {
  const tips: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  const open = orders.filter((j) => !['closed', 'cancelled'].includes(j.status))

  const overdueReturn = open.filter(
    (j) => j.expectedReturnDate < today && ['material_sent', 'partially_received'].includes(j.status),
  )
  if (overdueReturn.length) {
    tips.push(
      overdueReturn.length === 1
        ? 'Vendor material return is overdue.'
        : `${overdueReturn.length} vendor material returns are overdue.`,
    )
  }

  const underReceived = open.filter((j) => j.sentQty > 0 && j.receivedQty < j.sentQty && j.receivedQty > 0)
  if (underReceived.length) {
    tips.push('Received quantity is less than sent quantity. Reconciliation required.')
  }

  const recon = open.filter((j) => j.status === 'reconciliation_pending')
  if (recon.length) {
    tips.push(`${recon.length} job work document${recon.length === 1 ? '' : 's'} await reconciliation before close.`)
  }

  const draft = open.filter((j) => j.status === 'draft')
  if (draft.length) {
    tips.push(`${draft.length} draft job work order${draft.length === 1 ? '' : 's'} — send material to the vendor to start.`)
  }

  if (!tips.length) {
    tips.push('Job work looks clear. Create a new order from a work order when needed.')
  }
  return tips
}

export function buildJobWorkDetailAiInsights(jw: JobWorkOrder): string[] {
  const tips: string[] = []
  const today = new Date().toISOString().slice(0, 10)

  if (jw.status === 'draft') {
    tips.push('Send material to the vendor to start outside processing.')
  }
  if (jw.expectedReturnDate < today && ['material_sent', 'partially_received'].includes(jw.status)) {
    tips.push('Vendor material return is overdue.')
  }
  if (jw.sentQty > 0 && jw.receivedQty < jw.sentQty && jw.receivedQty > 0) {
    tips.push('Received quantity is less than sent quantity. Reconciliation required.')
  }
  if (jw.status === 'material_sent') {
    tips.push('Receive processed quantity when the vendor returns goods.')
  }
  if (jw.status === 'reconciliation_pending' || jw.status === 'received') {
    tips.push('Reconcile material balance, then link invoice placeholder and Close.')
  }
  if (!tips.length) {
    tips.push('Follow Send → Receive → Reconcile → Close on this job work.')
  }
  return tips
}
