import type { Prisma } from '@prisma/client'

export interface CorrectionDependency {
  code: string
  severity: 'blocker' | 'warning'
  message: string
  entityType?: string
  entityId?: string
}

export interface CorrectionImpactPreview {
  headline: string
  originalQuantity?: string
  alreadyReversedQuantity?: string
  maxReversibleQuantity?: string
  proposedQuantity?: string
  resultingQuantity?: string
  inventoryImpact?: string[]
  stageLedgerImpact?: string[]
  warnings: string[]
  blockers: string[]
  followUpActions: string[]
  approvalRequired: boolean
  riskLevel: string
  dependencies: CorrectionDependency[]
  recommendedPlan?: string[]
  original: Record<string, unknown>
  proposed: Record<string, unknown>
  sourceVersion: string
  previewToken: string
}

export interface CorrectionApplyResult {
  reversalEntityType: string
  reversalEntityId: string
  replacementEntityType?: string
  replacementEntityId?: string
  quantityReversed?: string
}

export interface CorrectionHandlerContext {
  tenantId: string
  userId: string
  transactionType: string
  correctionType: string
  sourceEntityType: string
  sourceEntityId: string
  productionOrderId?: string | null
  requestedAction: string
  requestedValues?: Record<string, unknown>
  reason: string
}

export interface CorrectionHandler {
  preview(ctx: CorrectionHandlerContext): Promise<CorrectionImpactPreview>
  apply(
    ctx: CorrectionHandlerContext,
    tx: Prisma.TransactionClient,
  ): Promise<CorrectionApplyResult>
}
