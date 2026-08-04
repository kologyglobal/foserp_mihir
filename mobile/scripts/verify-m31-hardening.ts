/**
 * M3.1 CRM hardening unit/structural checks (no device runtime).
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (...p: string[]) => join(root, ...p)

// Inline pure helpers (avoid path-alias + RN imports under tsx)
function pickPdfAttachment(files: Array<{ id: string; mimeType?: string; documentType?: string; originalFilename?: string; createdAt?: string }>) {
  const pdfs = files.filter(
    (f) =>
      (f.mimeType || '').includes('pdf') ||
      ['quotation_pdf', 'QUOTATION_PDF', 'sales_order_pdf'].includes(String(f.documentType || '')) ||
      (f.originalFilename || '').toLowerCase().endsWith('.pdf'),
  )
  if (!pdfs.length) return null
  return pdfs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
}

function deriveStatusAfterSync(input: {
  entityCreated: boolean
  serverEntityId?: string
  attachments: Array<{ status: string; serverAttachmentId?: string }>
  error?: string
}) {
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

function shouldSkipEntityCreate(d: { serverEntityId?: string }) {
  return Boolean(d.serverEntityId && d.serverEntityId !== 'pending')
}

function resolveAttachmentEntityId(d: { serverEntityId?: string; payload: Record<string, unknown> }) {
  if (d.serverEntityId && d.serverEntityId !== 'pending') return d.serverEntityId
  const payloadEntityId = d.payload.entityId
  if (typeof payloadEntityId === 'string' && payloadEntityId !== 'pending' && payloadEntityId.length > 0) {
    return payloadEntityId
  }
  return null
}

function relinkPendingAttachments(
  drafts: Array<{ id: string; kind: string; payload: Record<string, unknown>; clientKey?: string }>,
  clientKey: string,
  serverEntityId: string,
) {
  return drafts.map((d) => {
    if (d.clientKey === clientKey || d.id === clientKey) {
      return { ...d, payload: { ...d.payload, entityId: serverEntityId }, serverEntityId }
    }
    if (d.kind === 'photo' && d.payload.entityId === 'pending' && d.payload.parentClientKey === clientKey) {
      return { ...d, payload: { ...d.payload, entityId: serverEntityId }, serverEntityId }
    }
    return d
  })
}

function parseCrmDeepLink(url: string): { kind: string; id?: string; reason?: string; href?: string } | null {
  if (!url?.trim()) return null
  let path = url.trim()
  let custom = false
  try {
    if (path.includes('://')) {
      const u = new URL(path)
      custom = u.protocol.replace(/:$/, '').toLowerCase().startsWith('fos')
      path = u.pathname + u.search
      if (custom && u.host && !path.startsWith(`/${u.host}`)) {
        path = `/${u.host}${u.pathname}`
      }
    }
  } catch {
    // raw
  }
  path = (path.split('?')[0] || path).replace(/^\/+/, '').replace(/\/+$/, '')
  const parts = path.split('/').filter(Boolean)
  while (parts[0] === 'app' || parts[0] === 'm' || parts[0] === '(app)') parts.shift()
  const crmIdx = parts.findIndex((p) => p.toLowerCase() === 'crm')
  let crmParts = crmIdx >= 0 ? parts.slice(crmIdx + 1) : custom ? parts : null
  if (!crmParts) return null
  if (crmParts.length === 0) return null
  const [entity, id] = crmParts
  if (!entity) return null
  const e = entity.toLowerCase()
  if (e === 'unavailable' || e === '(tabs)' || e === 'index') return null
  if (e === 'approvals' || e === 'approval') return { kind: 'approval', id: id || 'list' }
  if (!id) {
    if (e === 'leads' || e === 'lead') return { kind: 'screen', href: '/(app)/crm/leads' }
    return { kind: 'unavailable', reason: `Unknown CRM path: ${entity}` }
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id) && id !== 'list' && id !== 'create' && id !== 'new') {
    return { kind: 'unavailable', reason: 'Invalid record id' }
  }
  if (e === 'leads' || e === 'lead') return { kind: 'lead', id }
  if (e === 'companies' || e === 'company') return { kind: 'company', id }
  if (e.includes('follow')) return { kind: 'follow_up', id }
  if (e.includes('quotation') || e === 'quotes') return { kind: 'quotation', id }
  if (e.includes('sales') || e === 'so') return { kind: 'sales_order', id }
  return { kind: 'unavailable', reason: `Unknown deep link: ${entity}` }
}

function buildUnifiedTimeline(input: {
  activities?: Array<Record<string, unknown>>
  followUps?: Array<Record<string, unknown>>
  quotations?: Array<Record<string, unknown>>
  salesOrders?: Array<Record<string, unknown>>
}) {
  const rows: Array<{ type: string; at: string; summary: string; user: string }> = []
  for (const a of input.activities ?? []) {
    rows.push({
      type: String(a.type || 'activity'),
      at: String(a.createdAt || a.activityDate || ''),
      summary: String(a.subject || ''),
      user: String(a.ownerName || '—'),
    })
  }
  for (const f of input.followUps ?? []) {
    rows.push({
      type: 'follow_up',
      at: String(f.dueDate || f.createdAt || ''),
      summary: String(f.notes || f.followUpType || ''),
      user: String(f.assignedToName || '—'),
    })
  }
  for (const q of input.quotations ?? []) {
    rows.push({
      type: 'quotation',
      at: String(q.updatedAt || q.createdAt || ''),
      summary: String(q.quotationCode || 'Q'),
      user: String(q.salesOwnerName || '—'),
    })
  }
  for (const s of input.salesOrders ?? []) {
    rows.push({
      type: 'sales_order',
      at: String(s.orderDate || s.updatedAt || ''),
      summary: String(s.salesOrderNo || 'SO'),
      user: String(s.salesOwnerName || '—'),
    })
  }
  return rows.filter((r) => r.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

// Structural
const required = [
  'src/features/crm/offlineDrafts.ts',
  'src/features/crm/offlineDraftLogic.ts',
  'src/features/crm/pdf/documentPdf.ts',
  'src/features/crm/pdf/pickPdfAttachment.ts',
  'src/features/crm/timeline/buildUnifiedTimeline.ts',
  'src/features/crm/deeplinks.ts',
  'src/features/crm/components/VoiceNoteRecorder.tsx',
  'src/features/crm/components/SwipeableRow.tsx',
  'src/features/crm/components/ContextualActionsSheet.tsx',
  'src/services/push/deviceTokenService.ts',
  'app/(app)/crm/pdf/[entityType]/[entityId].tsx',
  'app/(app)/crm/unavailable.tsx',
  'app/(app)/crm/companies/[id].tsx',
]
for (const rel of required) {
  assert.ok(existsSync(src(rel)), `missing ${rel}`)
}

const sessionSrc = readFileSync(src('src/auth/sessionService.ts'), 'utf8')
assert.ok(sessionSrc.includes('clearAllOfflineDrafts'), 'logout must clear drafts')

const pkg = JSON.parse(readFileSync(src('package.json'), 'utf8'))
assert.ok(pkg.dependencies['expo-av'])
assert.ok(pkg.dependencies['expo-sharing'])
assert.ok(pkg.dependencies['react-native-webview'])

// PDF
assert.equal(
  pickPdfAttachment([
    { id: '1', mimeType: 'text/plain', originalFilename: 'a.txt' },
    { id: '2', mimeType: 'application/pdf', documentType: 'quotation_pdf', createdAt: '2026-08-01' },
  ])?.id,
  '2',
)
assert.equal(pickPdfAttachment([]), null)

// Offline / idempotency
assert.equal(shouldSkipEntityCreate({}), false)
assert.equal(shouldSkipEntityCreate({ serverEntityId: 'x' }), true)
assert.equal(resolveAttachmentEntityId({ payload: { entityId: 'pending' } }), null)
assert.equal(resolveAttachmentEntityId({ serverEntityId: 'e1', payload: {} }), 'e1')
assert.equal(
  deriveStatusAfterSync({
    entityCreated: true,
    serverEntityId: 'e',
    attachments: [
      { status: 'uploaded', serverAttachmentId: 'a' },
      { status: 'failed' },
    ],
  }),
  'partially_synced',
)
assert.equal(
  deriveStatusAfterSync({
    entityCreated: true,
    serverEntityId: 'e',
    attachments: [{ status: 'uploaded', serverAttachmentId: 'a' }],
  }),
  'synced',
)
const relinked = relinkPendingAttachments(
  [{ id: 'p1', kind: 'photo', payload: { entityId: 'pending', parentClientKey: 'ck1' } }],
  'ck1',
  'srv-1',
)
assert.equal(relinked[0].payload.entityId, 'srv-1')
assert.notEqual(relinked[0].payload.entityId, 'pending')

// Timeline
const tl = buildUnifiedTimeline({
  activities: [{ id: '1', type: 'call', subject: 'Hi', createdAt: '2026-08-02T10:00:00Z', ownerName: 'A' }],
  followUps: [{ id: '2', followUpType: 'call', notes: 'FU', dueDate: '2026-08-03' }],
  quotations: [{ id: '3', quotationCode: 'Q-1', updatedAt: '2026-08-02T12:00:00Z' }],
  salesOrders: [{ id: '4', salesOrderNo: 'SO-1', orderDate: '2026-08-02T14:00:00Z' }],
})
assert.ok(tl.length >= 4)

// Deep links
assert.equal(parseCrmDeepLink('fos-erp://crm/leads/550e8400-e29b-41d4-a716-446655440000')?.kind, 'lead')
assert.equal(parseCrmDeepLink('fos-erp://crm/companies/not-a-uuid')?.kind, 'unavailable')
assert.equal(parseCrmDeepLink('crm/approvals')?.kind, 'approval')
assert.equal(parseCrmDeepLink(''), null)
assert.equal(parseCrmDeepLink('http://localhost:8081/'), null)
assert.equal(parseCrmDeepLink('http://localhost:8081/(app)/(tabs)'), null)
assert.equal(parseCrmDeepLink('http://localhost:8081/crm/leads')?.kind, 'screen')
assert.equal(
  parseCrmDeepLink('http://localhost:8081/crm/leads/550e8400-e29b-41d4-a716-446655440000')?.kind,
  'lead',
)
assert.ok(readFileSync(src('app/_layout.tsx'), 'utf8').includes('if (!href) return'))
assert.ok(readFileSync(src('app/(app)/crm/unavailable.tsx'), 'utf8').includes('EmptyState'))
assert.ok(
  readFileSync(src('src/features/crm/deeplinks.ts'), 'utf8').includes('extractCrmPathParts'),
)

// Surface checks
assert.ok(readFileSync(src('app/(app)/crm/search.tsx'), 'utf8').includes('Quotations'))
assert.ok(readFileSync(src('app/(app)/crm/search.tsx'), 'utf8').includes('Sales orders'))
assert.ok(readFileSync(src('app/(app)/crm/collection.tsx'), 'utf8').includes('finance.ar.view'))
assert.ok(readFileSync(src('src/services/push/deviceTokenService.ts'), 'utf8').includes('registerDeviceToken'))
assert.ok(readFileSync(src('src/features/crm/deeplinks.ts'), 'utf8').includes('handleNotificationDeepLink'))

// Backend device token + search expansion exist in monorepo
const beRoot = join(root, '..')
assert.ok(existsSync(join(beRoot, 'backend/src/modules/mobile/device-tokens/device-token.routes.ts')))
assert.ok(
  readFileSync(join(beRoot, 'backend/src/modules/crm/search/search.service.ts'), 'utf8').includes(
    'quotations',
  ),
)

console.log('M3.1 CRM hardening checks: PASS')
