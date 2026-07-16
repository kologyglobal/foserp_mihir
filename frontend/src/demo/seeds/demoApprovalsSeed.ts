import { useApprovalStore } from '../../store/approvalStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useEcoStore } from '../../store/ecoStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Create approval requests linked to POs, ECOs, and sales orders */
export function seedDemoApprovals(): void {
  const approval = useApprovalStore.getState()

  for (const po of usePurchaseStore.getState().purchaseOrders) {
    if (approval.requests.length >= SATURATION_TARGETS.approvalRequests) break
    if (approval.requests.some((r) => r.entityId === po.id)) continue
    if (po.status === 'draft') continue
    approval.createRequest({
      documentType: 'purchase_order',
      entityId: po.id,
      entityLabel: po.poNo,
      submittedByName: 'Demo Buyer',
      context: { totalAmount: po.lines.reduce((s, l) => s + l.qty * l.rate, 0) },
      steps: [],
    })
  }

  for (const eco of useEcoStore.getState().ecos) {
    if (approval.requests.length >= SATURATION_TARGETS.approvalRequests) break
    if (approval.requests.some((r) => r.entityId === eco.id)) continue
    approval.createRequest({
      documentType: 'engineering_change',
      entityId: eco.id,
      entityLabel: eco.ecoNo,
      submittedByName: 'Engineering Lead',
      context: { isRevision: true, totalAmount: eco.costImpact },
      steps: [],
    })
  }

  for (const pr of usePurchaseStore.getState().requisitions) {
    if (approval.requests.length >= SATURATION_TARGETS.approvalRequests) break
    if (approval.requests.some((r) => r.entityId === pr.id)) continue
    approval.createRequest({
      documentType: 'purchase_requisition',
      entityId: pr.id,
      entityLabel: pr.prNo,
      submittedByName: 'MRP Planner',
      context: { totalAmount: pr.lines.reduce((s, l) => s + l.qty * 100, 0) },
      steps: [],
    })
  }
}
