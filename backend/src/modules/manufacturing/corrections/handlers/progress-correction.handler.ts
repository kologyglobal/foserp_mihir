import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import { toDecimal } from '../../shared/quantity.service.js'
import { correctProgress } from '../../work-orders/work-order-progress.service.js'
import { CorrectionBlockedError, CorrectionValidationError } from '../correction.errors.js'
import { collectDependencies } from '../correction-dependency.service.js'
import { emptyPreview, makePreviewToken, makeSourceVersion } from '../correction-preview.util.js'
import type { CorrectionApplyResult, CorrectionHandler } from '../correction.types.js'
import { defaultApprovalRequired, defaultRisk } from '../correction.enums.js'

export const productionProgressHandler: CorrectionHandler = {
  async preview(ctx) {
    const original = await prisma.productionStageLedger.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!original) throw new NotFoundError('Progress ledger entry not found')
    if (original.transactionType !== 'PROGRESS_RECORDED') {
      throw new CorrectionValidationError('Only PROGRESS_RECORDED entries can be corrected')
    }
    const already = await prisma.productionStageLedger.findFirst({
      where: { tenantId: ctx.tenantId, reversalOfId: original.id, transactionType: 'REVERSAL' },
    })
    if (already) throw new CorrectionValidationError('This ledger entry has already been corrected')

    const requested = (ctx.requestedValues ?? {}) as {
      goodQuantity?: number
      reworkQuantity?: number
      rejectedQuantity?: number
      scrapQuantity?: number
    }
    const deps = await collectDependencies({ ...ctx, productionOrderId: original.productionOrderId })
    const blockers = deps.filter((d) => d.severity === 'blocker').map((d) => d.message)
    const risk = defaultRisk('PRODUCTION_PROGRESS')
    const sourceVersion = makeSourceVersion(original.createdAt, original.id)
    const originalQty = toDecimal(original.goodQuantity).toString()
    const proposedGood = requested.goodQuantity ?? 0

    return emptyPreview({
      headline: `Correct progress ${originalQty} good → ${proposedGood} good`,
      originalQuantity: originalQty,
      maxReversibleQuantity: originalQty,
      proposedQuantity: String(proposedGood),
      resultingQuantity: String(proposedGood),
      stageLedgerImpact: [
        'Original PROGRESS_RECORDED remains',
        'REVERSAL then CORRECTION ledger rows will be appended',
      ],
      blockers,
      warnings: deps.filter((d) => d.severity === 'warning').map((d) => d.message),
      dependencies: deps,
      approvalRequired: defaultApprovalRequired(risk) || blockers.length > 0,
      riskLevel: blockers.length ? 'HIGH' : risk,
      followUpActions: blockers.length
        ? ['Resolve blockers before apply']
        : ['Apply to post Stage Ledger reversal + correction'],
      original: {
        ledgerEntryId: original.id,
        goodQuantity: original.goodQuantity.toString(),
        reworkQuantity: original.reworkQuantity.toString(),
        rejectedQuantity: original.rejectedQuantity.toString(),
        scrapQuantity: original.scrapQuantity.toString(),
        stageId: original.stageId,
        productionOrderId: original.productionOrderId,
      },
      proposed: {
        goodQuantity: proposedGood,
        reworkQuantity: requested.reworkQuantity ?? Number(original.reworkQuantity),
        rejectedQuantity: requested.rejectedQuantity ?? Number(original.rejectedQuantity),
        scrapQuantity: requested.scrapQuantity ?? Number(original.scrapQuantity),
      },
      sourceVersion,
      previewToken: makePreviewToken({ id: original.id, sourceVersion, proposedGood }),
    })
  },

  async apply(ctx, tx) {
    const deps = await collectDependencies(ctx)
    const blockers = deps.filter((d) => d.severity === 'blocker')
    if (blockers.length) throw new CorrectionBlockedError(blockers[0]!.message)

    const original = await tx.productionStageLedger.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!original) throw new NotFoundError('Progress ledger entry not found')

    const requested = (ctx.requestedValues ?? {}) as {
      goodQuantity?: number
      reworkQuantity?: number
      rejectedQuantity?: number
      scrapQuantity?: number
    }

    const fakeReq = { context: { userId: ctx.userId } } as Request
    const result = await correctProgress(
      fakeReq,
      ctx.tenantId,
      original.productionOrderId,
      {
        ledgerEntryId: ctx.sourceEntityId,
        goodQuantity: requested.goodQuantity ?? 0,
        reworkQuantity: requested.reworkQuantity ?? 0,
        rejectedQuantity: requested.rejectedQuantity ?? 0,
        scrapQuantity: requested.scrapQuantity ?? 0,
        reason: ctx.reason,
      },
      { tx, skipAudit: true },
    )

    return {
      reversalEntityType: 'PRODUCTION_STAGE_LEDGER',
      reversalEntityId: result.reversal.id,
      replacementEntityType: 'PRODUCTION_STAGE_LEDGER',
      replacementEntityId: result.correction.id,
      quantityReversed: original.goodQuantity.toString(),
    } satisfies CorrectionApplyResult
  },
}
