/**
 * Pure offline draft sync helpers (unit-testable without FileSystem).
 */

import type {
  OfflineAttachmentStatus,
  OfflineDraft,
  OfflineDraftAttachment,
  OfflineDraftStatus,
} from '@/types/crm'

export function newClientKey(prefix = 'ck'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function migrateDraft(raw: OfflineDraft | Record<string, unknown>): OfflineDraft {
  const d = raw as OfflineDraft
  const status: OfflineDraftStatus =
    d.status ??
    (d.synced ? 'synced' : d.error ? 'failed' : 'pending')
  return {
    id: String(d.id),
    kind: d.kind as OfflineDraft['kind'],
    clientKey: d.clientKey || String(d.id),
    payload: (d.payload as Record<string, unknown>) ?? {},
    createdAt: d.createdAt || new Date().toISOString(),
    synced: status === 'synced',
    status,
    serverEntityId: d.serverEntityId,
    serverEntityType: d.serverEntityType,
    attachments: (d.attachments ?? []).map(normalizeAttachment),
    error: d.error,
    attempts: d.attempts ?? 0,
  }
}

function normalizeAttachment(a: OfflineDraftAttachment | Record<string, unknown>): OfflineDraftAttachment {
  const row = a as OfflineDraftAttachment
  return {
    id: String(row.id || newClientKey('att')),
    localUri: row.localUri,
    contentBase64: row.contentBase64,
    originalFilename: String(row.originalFilename || 'file.bin'),
    mimeType: String(row.mimeType || 'application/octet-stream'),
    documentType: String(row.documentType || 'GENERAL'),
    status: (row.status as OfflineAttachmentStatus) || 'pending',
    serverAttachmentId: row.serverAttachmentId,
    error: row.error,
    clientKey: row.clientKey || String(row.id || newClientKey('att')),
  }
}

/**
 * True when draft should not create a new parent entity again.
 */
export function shouldSkipEntityCreate(draft: OfflineDraft): boolean {
  return Boolean(draft.serverEntityId && draft.serverEntityId !== 'pending')
}

/**
 * Derive overall draft status from attachments after entity exists.
 */
export function deriveStatusAfterSync(input: {
  entityCreated: boolean
  serverEntityId?: string
  attachments: OfflineDraftAttachment[]
  error?: string
}): OfflineDraftStatus {
  if (input.error && !input.entityCreated) return 'failed'
  const atts = input.attachments
  if (atts.length === 0) {
    if (input.error) return 'failed'
    return input.entityCreated || input.serverEntityId ? 'synced' : 'pending'
  }
  const uploaded = atts.filter((a) => a.status === 'uploaded' || a.serverAttachmentId).length
  const failed = atts.filter((a) => a.status === 'failed').length
  const pending = atts.length - uploaded - failed
  if (uploaded === atts.length) return 'synced'
  if (failed > 0 && uploaded > 0) return 'partially_synced'
  if (failed > 0 && uploaded === 0 && pending === 0) return 'failed'
  if (input.entityCreated || input.serverEntityId) {
    if (pending > 0 || failed > 0) return 'partially_synced'
    return 'synced'
  }
  return 'pending'
}

/**
 * Attachments must never remain linked to entityId=pending once sync resolves the parent.
 */
export function resolveAttachmentEntityId(draft: OfflineDraft): string | null {
  if (draft.serverEntityId && draft.serverEntityId !== 'pending') {
    return draft.serverEntityId
  }
  const payloadEntityId = draft.payload.entityId
  if (typeof payloadEntityId === 'string' && payloadEntityId !== 'pending' && payloadEntityId.length > 0) {
    return payloadEntityId
  }
  return null
}

export function relinkPendingAttachments(
  drafts: OfflineDraft[],
  clientKey: string,
  serverEntityId: string,
): OfflineDraft[] {
  return drafts.map((d) => {
    if (d.clientKey === clientKey || d.id === clientKey) {
      return {
        ...d,
        serverEntityId,
        synced: false,
        status: 'partially_synced' as OfflineDraftStatus,
        payload: {
          ...d.payload,
          entityId: serverEntityId,
        },
        attachments: (d.attachments ?? []).map((a) =>
          a.status === 'uploaded' ? a : { ...a, status: 'pending' as OfflineAttachmentStatus },
        ),
      }
    }
    // Standalone photo drafts that referenced pending are rewritten when parent meets them via groupKey
    if (
      d.kind === 'photo' &&
      d.payload.entityId === 'pending' &&
      d.payload.parentClientKey === clientKey
    ) {
      return {
        ...d,
        serverEntityId,
        status: 'partially_synced' as OfflineDraftStatus,
        payload: { ...d.payload, entityId: serverEntityId },
      }
    }
    return d
  })
}

export function isFullySynced(draft: OfflineDraft): boolean {
  return draft.status === 'synced' || (draft.synced && draft.status !== 'partially_synced' && draft.status !== 'failed')
}
