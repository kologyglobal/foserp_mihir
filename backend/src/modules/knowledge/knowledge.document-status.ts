import type { KnowledgeDocumentStatus } from '@prisma/client'
import { InvalidStateError } from '../../utils/errors.js'

/** Allowed status transitions (Wave 2 lifecycle — index/extract fill PROCESSING in Wave 3). */
const TRANSITIONS: Record<KnowledgeDocumentStatus, KnowledgeDocumentStatus[]> = {
  DRAFT: ['PROCESSING', 'READY', 'ARCHIVED'],
  PROCESSING: ['READY', 'FAILED', 'DRAFT'],
  READY: ['PROCESSING', 'DRAFT', 'ARCHIVED'],
  FAILED: ['PROCESSING', 'DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
}

export function assertDocumentStatusTransition(
  from: KnowledgeDocumentStatus,
  to: KnowledgeDocumentStatus,
): void {
  if (from === to) return
  const allowed = TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new InvalidStateError(
      `Knowledge document cannot move from ${from} to ${to}`,
    )
  }
}

export function canPublish(status: KnowledgeDocumentStatus): boolean {
  return status === 'DRAFT' || status === 'FAILED' || status === 'PROCESSING'
}

export function canQueueIndex(status: KnowledgeDocumentStatus): boolean {
  return status === 'DRAFT' || status === 'READY' || status === 'FAILED'
}
