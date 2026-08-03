/** Re-export pure offline helpers for node unit runner without path alias. */
export {
  deriveStatusAfterSync,
  migrateDraft,
  relinkPendingAttachments,
  resolveAttachmentEntityId,
  shouldSkipEntityCreate,
  newClientKey,
} from '../src/features/crm/offlineDraftLogic.ts'

export function parseUnsafe(x: unknown) {
  return x
}
