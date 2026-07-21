import { randomUUID } from 'node:crypto'
import type { CodeSeriesEntity, Prisma } from '@prisma/client'
import { nextCode, previewNextCode } from '../../../services/codeSeries.service.js'

/**
 * Allocate a purchase document number. Falls back when the local DB
 * has not yet applied code-series enum migrations (e.g. PURCHASE_ORDER).
 */
export async function nextPurchaseDocumentNumber(
  tenantId: string,
  entityType: CodeSeriesEntity,
  fallbackPrefix: string,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  try {
    return await nextCode(tenantId, entityType, tx)
  } catch {
    return `${fallbackPrefix}-${Date.now()}-${randomUUID().slice(0, 8)}`
  }
}

/** Non-consuming peek at the next purchase document number. */
export async function previewPurchaseDocumentNumber(
  tenantId: string,
  entityType: CodeSeriesEntity,
  fallbackPrefix: string,
): Promise<string> {
  try {
    return await previewNextCode(tenantId, entityType)
  } catch {
    return `${fallbackPrefix}-000001`
  }
}
