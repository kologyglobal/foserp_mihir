import { InvalidStateError } from '../../utils/errors.js'
import {
  KNOWLEDGE_STATUS_TRANSITIONS,
  type KnowledgeDocumentStatusName,
} from './knowledge.constants.js'

export function assertStatusTransition(
  from: KnowledgeDocumentStatusName,
  to: KnowledgeDocumentStatusName,
): void {
  if (from === to) return
  const allowed = KNOWLEDGE_STATUS_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new InvalidStateError(
      `Cannot transition knowledge document from ${from} to ${to}`,
    )
  }
}

export function canPublishWithoutMarkdown(status: KnowledgeDocumentStatusName): boolean {
  return status === 'DRAFT' || status === 'FAILED'
}
