import type { OfflineDraft, OfflineDraftAttachment, OfflineDraftKind } from '@/types/crm'
import {
  createActivity,
  createCompany,
  createContact,
  createEntityAttachment,
  createEntityNote,
  createFollowUp,
  createLead,
} from '@/api/crmApi'
import { useSessionStore } from '@/store/sessionStore'
import {
  clearDraftMediaCacheDir,
  deleteLocalFileIfPossible,
  readDraftsPayload,
  readFileBase64,
  writeDraftsPayload,
} from '@/utils/files'
import {
  deriveStatusAfterSync,
  migrateDraft,
  newClientKey,
  resolveAttachmentEntityId,
  shouldSkipEntityCreate,
} from '@/features/crm/offlineDraftLogic'
import { toCompanyPayload, toContactPayload, toLeadPayload } from '@/features/crm/businessCard/mapToCrmPayloads'
import type { BusinessCardFields, BusinessCardSaveMode } from '@/features/crm/businessCard/types'

async function readAll(): Promise<OfflineDraft[]> {
  try {
    const raw = await readDraftsPayload()
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineDraft[]
    return (Array.isArray(parsed) ? parsed : []).map(migrateDraft)
  } catch {
    return []
  }
}

async function writeAll(drafts: OfflineDraft[]): Promise<void> {
  await writeDraftsPayload(JSON.stringify(drafts))
}

export async function listOfflineDrafts(): Promise<OfflineDraft[]> {
  return readAll()
}

export async function clearAllOfflineDrafts(): Promise<void> {
  await writeAll([])
  await clearDraftMediaCacheDir()
}

export async function saveOfflineDraft(
  kind: OfflineDraftKind,
  payload: Record<string, unknown>,
  options?: {
    attachments?: Array<Omit<OfflineDraftAttachment, 'id' | 'status' | 'clientKey'> & { clientKey?: string }>
    clientKey?: string
    parentClientKey?: string
  },
): Promise<OfflineDraft> {
  const drafts = await readAll()
  const clientKey = options?.clientKey || newClientKey('draft')
  const attachments: OfflineDraftAttachment[] = (options?.attachments ?? []).map((a) => ({
    id: newClientKey('att'),
    clientKey: a.clientKey || newClientKey('attk'),
    localUri: a.localUri,
    contentBase64: a.contentBase64,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    documentType: a.documentType,
    status: 'pending',
  }))

  const item: OfflineDraft = {
    id: newClientKey('d'),
    kind,
    clientKey,
    payload: {
      ...payload,
      ...(options?.parentClientKey ? { parentClientKey: options.parentClientKey } : {}),
      clientKey,
    },
    createdAt: new Date().toISOString(),
    synced: false,
    status: 'pending',
    attachments,
    attempts: 0,
  }
  drafts.unshift(item)
  await writeAll(drafts.slice(0, 100))
  return item
}

export async function removeOfflineDraft(id: string): Promise<void> {
  const drafts = await readAll()
  await writeAll(drafts.filter((d) => d.id !== id))
}

export async function clearSyncedDrafts(): Promise<void> {
  const drafts = await readAll()
  await writeAll(drafts.filter((d) => d.status !== 'synced'))
}

async function resolveBase64(att: OfflineDraftAttachment): Promise<string> {
  if (att.contentBase64) return att.contentBase64
  if (att.localUri) return readFileBase64(att.localUri)
  throw new Error('Attachment has no local content')
}

async function uploadAttachments(
  draft: OfflineDraft,
  entityType: string,
  entityId: string,
): Promise<OfflineDraftAttachment[]> {
  const atts = draft.attachments ?? []
  const next: OfflineDraftAttachment[] = []
  for (const att of atts) {
    if (att.status === 'uploaded' && att.serverAttachmentId) {
      next.push(att)
      continue
    }
    if (entityId === 'pending') {
      next.push({ ...att, status: 'pending', error: 'Waiting for parent entity' })
      continue
    }
    try {
      const contentBase64 = await resolveBase64(att)
      const res = await createEntityAttachment(entityType, entityId, {
        originalFilename: att.originalFilename,
        mimeType: att.mimeType,
        contentBase64,
        documentType: att.documentType || 'GENERAL',
        // backend ignores unknown keys; clientKey kept for local dedupe only
      })
      // Cleanup local file after success
      await deleteLocalFileIfPossible(att.localUri)
      next.push({
        ...att,
        contentBase64: undefined,
        localUri: undefined,
        status: 'uploaded',
        serverAttachmentId: res.data?.id,
        error: undefined,
      })
    } catch (e) {
      next.push({
        ...att,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Upload failed',
      })
    }
  }
  return next
}

async function syncOne(draft: OfflineDraft): Promise<OfflineDraft> {
  const working: OfflineDraft = {
    ...migrateDraft(draft),
    status: 'syncing',
    attempts: (draft.attempts ?? 0) + 1,
    error: undefined,
  }

  try {
    if (working.kind === 'follow_up') {
      let entityId = working.serverEntityId
      if (!shouldSkipEntityCreate(working)) {
        const created = await createFollowUp({
          ...working.payload,
          clientKey: working.clientKey,
        })
        entityId = created.data?.id
        working.serverEntityId = entityId
        working.serverEntityType = 'FOLLOW_UP'
      }
      const atts = await uploadAttachments(working, 'FOLLOW_UP', entityId || '')
      working.attachments = atts
      working.status = deriveStatusAfterSync({
        entityCreated: Boolean(entityId),
        serverEntityId: entityId,
        attachments: atts,
      })
      working.synced = working.status === 'synced'
      return working
    }

    if (working.kind === 'meeting') {
      let entityId = working.serverEntityId
      if (!shouldSkipEntityCreate(working)) {
        const body = { type: 'meeting', ...working.payload, clientKey: working.clientKey }
        const created = await createActivity(body)
        entityId = created.data?.id
        working.serverEntityId = entityId
        working.serverEntityType = 'ACTIVITY'
      }
      const atts = await uploadAttachments(working, 'ACTIVITY', entityId || '')
      working.attachments = atts
      working.status = deriveStatusAfterSync({
        entityCreated: Boolean(entityId),
        serverEntityId: entityId,
        attachments: atts,
      })
      working.synced = working.status === 'synced'
      return working
    }

    if (working.kind === 'note') {
      const { entityType, entityId, content, noteType } = working.payload as {
        entityType: string
        entityId: string
        content: string
        noteType?: string
      }
      if (!entityId || entityId === 'pending') {
        throw new Error('Note draft needs a real entity id')
      }
      if (!shouldSkipEntityCreate(working)) {
        const created = await createEntityNote(entityType, entityId, content, noteType)
        working.serverEntityId = created.data?.id
        working.serverEntityType = 'NOTE'
      }
      const atts = await uploadAttachments(working, entityType, entityId)
      working.attachments = atts
      working.status = deriveStatusAfterSync({
        entityCreated: true,
        serverEntityId: working.serverEntityId || entityId,
        attachments: atts,
      })
      working.synced = working.status === 'synced'
      return working
    }

    if (working.kind === 'photo' || working.kind === 'audio') {
      let entityType = String(working.payload.entityType || working.serverEntityType || '')
      let entityId = resolveAttachmentEntityId(working)
      if (!entityId) {
        throw new Error('Attachment draft needs parent entity id (not pending)')
      }
      if (!entityType) entityType = 'ACTIVITY'
      // Promote payload fields into attachment list when legacy shape
      if (!working.attachments?.length) {
        const p = working.payload as {
          originalFilename: string
          mimeType: string
          contentBase64?: string
          localUri?: string
          documentType: string
        }
        working.attachments = [
          {
            id: newClientKey('att'),
            clientKey: working.clientKey,
            originalFilename: p.originalFilename || 'file.bin',
            mimeType: p.mimeType || 'application/octet-stream',
            contentBase64: p.contentBase64,
            localUri: p.localUri,
            documentType: p.documentType || (working.kind === 'audio' ? 'VOICE_NOTE' : 'PHOTO'),
            status: 'pending',
          },
        ]
      }
      const atts = await uploadAttachments(working, entityType, entityId)
      working.attachments = atts
      working.serverEntityId = entityId
      working.serverEntityType = entityType
      working.status = deriveStatusAfterSync({
        entityCreated: true,
        serverEntityId: entityId,
        attachments: atts,
      })
      working.synced = working.status === 'synced'
      return working
    }

    if (working.kind === 'business_card') {
      const p = working.payload as {
        saveMode?: BusinessCardSaveMode | 'draft'
        fields: BusinessCardFields
        existingCompanyId?: string | null
      }
      const mode = p.saveMode || 'create_lead'
      if (mode === 'draft') {
        // Draft-only stays until user opens scanner again — mark synced so it is not infinite fail
        working.status = 'synced'
        working.synced = true
        return working
      }

      let entityType = 'LEAD'
      let entityId = working.serverEntityId

      if (!shouldSkipEntityCreate(working)) {
        const userId = useSessionStore.getState().profile?.user.id
        if (mode === 'create_lead') {
          const created = await createLead(
            toLeadPayload(p.fields, { leadOwnerId: userId ?? null }),
          )
          entityId = created.data?.id
          entityType = 'LEAD'
        } else if (mode === 'create_company_contact') {
          const company = await createCompany(toCompanyPayload(p.fields, { ownerId: userId }))
          entityId = company.data?.id
          entityType = 'COMPANY'
          if (entityId && (p.fields.firstName || p.fields.mobile || p.fields.email)) {
            try {
              await createContact(toContactPayload(p.fields, entityId, { ownerId: userId }))
            } catch {
              // keep company
            }
          }
        } else if (mode === 'add_contact_existing') {
          const companyId = p.existingCompanyId
          if (!companyId) throw new Error('Business card contact draft missing company')
          const contact = await createContact(
            toContactPayload(p.fields, companyId, { ownerId: userId }),
          )
          entityId = contact.data?.id
          entityType = 'CONTACT'
        } else {
          throw new Error(`Unknown business card save mode: ${mode}`)
        }
        working.serverEntityId = entityId
        working.serverEntityType = entityType
      }

      if (!entityId) throw new Error('Business card entity was not created')
      const atts = await uploadAttachments(working, entityType, entityId)
      working.attachments = atts
      working.status = deriveStatusAfterSync({
        entityCreated: true,
        serverEntityId: entityId,
        attachments: atts,
      })
      working.synced = working.status === 'synced'
      return working
    }

    throw new Error(`Unknown draft kind: ${working.kind}`)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    working.error = message
    working.status = working.serverEntityId ? 'partially_synced' : 'failed'
    working.synced = false
    return working
  }
}

/** Attempt to push unsynced drafts when online. Ordered: parents first, then attachments. */
export async function syncOfflineDrafts(): Promise<{
  synced: number
  failed: number
  partial: number
}> {
  const online = useSessionStore.getState().isOnline
  if (!online) return { synced: 0, failed: 0, partial: 0 }

  const drafts = await readAll()
  let synced = 0
  let failed = 0
  let partial = 0

  // Parent entities before free-floating attachment drafts
  const priority = (k: OfflineDraft['kind']) => {
    if (k === 'business_card' || k === 'meeting' || k === 'follow_up') return 0
    if (k === 'note') return 1
    return 2
  }
  const ordered = [...drafts].sort((a, b) => priority(a.kind) - priority(b.kind))

  // Build parent map: clientKey -> server id after parent syncs
  const parentMap = new Map<string, string>()
  const next: OfflineDraft[] = []

  for (const d of ordered) {
    if (d.status === 'synced') {
      // drop fully synced from queue
      continue
    }

    // Relink pending photos/audio that wait on parent draft
    const parentKey = d.payload.parentClientKey as string | undefined
    if (parentKey && parentMap.has(parentKey)) {
      d.serverEntityId = parentMap.get(parentKey)
      d.payload = { ...d.payload, entityId: d.serverEntityId }
    }

    const result = await syncOne(d)
    if (result.serverEntityId && (result.kind === 'meeting' || result.kind === 'follow_up')) {
      parentMap.set(result.clientKey, result.serverEntityId)
    }

    if (result.status === 'synced') {
      synced += 1
      // drop
    } else if (result.status === 'partially_synced') {
      partial += 1
      next.push(result)
    } else {
      failed += 1
      next.push(result)
    }
  }

  await writeAll(next)
  return { synced, failed, partial }
}

export async function retryOfflineDraft(id: string): Promise<OfflineDraft | null> {
  const drafts = await readAll()
  const idx = drafts.findIndex((d) => d.id === id)
  if (idx < 0) return null
  const current = drafts[idx]
  if (!current) return null
  const result = await syncOne({
    ...current,
    status: 'pending',
    error: undefined,
  })
  if (result.status === 'synced') {
    drafts.splice(idx, 1)
  } else {
    drafts[idx] = result
  }
  await writeAll(drafts)
  return result
}
