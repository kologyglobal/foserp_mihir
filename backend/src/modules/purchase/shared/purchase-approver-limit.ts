import { prisma } from '../../../config/database.js'
import type { PurchaseApprovalTierDocumentType } from '@prisma/client'
import { PURCHASE_ERROR_CODE, purchaseMessage } from './purchase-error-catalog.js'

export type ApproverLimitDocumentKind = 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'

/**
 * When the actor has an active per-user INR ceiling for the document type (or ALL),
 * reject if document amount exceeds the tightest matching limit.
 * Users with no limit row are unrestricted (matrix role binding still applies).
 */
export async function assertActorWithinApproverLimit(opts: {
  tenantId: string
  actorId: string
  documentAmount: number
  documentType: ApproverLimitDocumentKind
  makeError: (message: string, code: string) => Error
}): Promise<void> {
  const { tenantId, actorId, documentAmount, documentType, makeError } = opts
  const settings = await prisma.purchaseSettings.findUnique({
    where: { tenantId },
    select: {
      approverLimits: {
        where: { userId: actorId, isActive: true },
        select: { maxAmountInr: true, documentType: true },
      },
    },
  })
  const limits = settings?.approverLimits ?? []
  if (!limits.length) return

  const matching = limits.filter(
    (l) => l.documentType === 'ALL' || l.documentType === documentType,
  )
  if (!matching.length) return

  const maxAllowed = Math.min(...matching.map((l) => Number(l.maxAmountInr)))
  if (documentAmount > maxAllowed + 0.009) {
    throw makeError(
      purchaseMessage(PURCHASE_ERROR_CODE.APPROVAL_USER_LIMIT_EXCEEDED),
      PURCHASE_ERROR_CODE.APPROVAL_USER_LIMIT_EXCEEDED,
    )
  }
}

export function docTypeMatchesLimit(
  limitType: PurchaseApprovalTierDocumentType,
  documentType: ApproverLimitDocumentKind,
): boolean {
  return limitType === 'ALL' || limitType === documentType
}
