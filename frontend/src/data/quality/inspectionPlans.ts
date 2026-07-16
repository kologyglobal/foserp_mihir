import type { InspectionPlan } from '../../types/quality'
import { FINAL_QC_CHECKLIST } from '../../types/quality'

export const seedInspectionPlans: InspectionPlan[] = [
  {
    id: 'plan-incoming-rm',
    planCode: 'IQC-RM',
    planName: 'Incoming Raw Material QC',
    category: 'incoming',
    scope: 'item',
    itemId: 'item-rm-plt',
    operationName: null,
    productId: null,
    checklist: [
      { id: 'iqc-mtc', label: 'MTC / mill test certificate verified', sortOrder: 10, mandatory: true },
      { id: 'iqc-dim', label: 'Dimensions within tolerance', sortOrder: 20, mandatory: true },
      { id: 'iqc-surf', label: 'Surface condition acceptable', sortOrder: 30, mandatory: true },
    ],
    isActive: true,
  },
  {
    id: 'plan-incoming-bo',
    planCode: 'IQC-BO',
    planName: 'Incoming Bought-Out QC',
    category: 'incoming',
    scope: 'item',
    itemId: 'item-bo-axl',
    operationName: null,
    productId: null,
    checklist: [
      { id: 'iqc-inv', label: 'Invoice / packing list match', sortOrder: 10, mandatory: true },
      { id: 'iqc-spec', label: 'Specification tag verified', sortOrder: 20, mandatory: true },
    ],
    isActive: true,
  },
  {
    id: 'plan-final-fg',
    planCode: 'FQC-FG',
    planName: 'Final FG QC — Bulker Trailer',
    category: 'final',
    scope: 'product',
    itemId: null,
    operationName: null,
    productId: 'prod-45m3',
    checklist: FINAL_QC_CHECKLIST,
    isActive: true,
  },
]

export function resolveInspectionPlan(input: {
  category: 'incoming' | 'in_process' | 'final'
  itemId?: string | null
  productId?: string | null
  operationName?: string | null
}): InspectionPlan | undefined {
  const plans = seedInspectionPlans.filter((p) => p.isActive && p.category === input.category)
  if (input.category === 'incoming' && input.itemId) {
    return plans.find((p) => p.itemId === input.itemId) ?? plans.find((p) => p.scope === 'item')
  }
  if (input.category === 'final' && input.productId) {
    return plans.find((p) => p.productId === input.productId)
  }
  if (input.category === 'in_process' && input.operationName) {
    return plans.find((p) => p.operationName === input.operationName)
  }
  return undefined
}
