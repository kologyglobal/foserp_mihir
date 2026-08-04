/**
 * Unified chronological timeline mapping from existing CRM API payloads.
 */
export type TimelineSourceKind =
  | 'call'
  | 'meeting'
  | 'follow_up'
  | 'note'
  | 'attachment'
  | 'quotation'
  | 'quotation_approval'
  | 'sales_order'
  | 'payment'
  | 'activity'

export interface UnifiedTimelineEntry {
  id: string
  type: TimelineSourceKind
  user: string
  at: string
  summary: string
  sourceDocument?: string
  status?: string
  href?: string
}

function asIso(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function sortNewestFirst(entries: UnifiedTimelineEntry[]): UnifiedTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const ta = Date.parse(a.at) || 0
    const tb = Date.parse(b.at) || 0
    return tb - ta
  })
}

export function mapActivitiesToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  return rows.map((a) => {
    const typeRaw = String(a.type || a.activityType || 'activity').toLowerCase()
    const type: TimelineSourceKind =
      typeRaw.includes('call')
        ? 'call'
        : typeRaw.includes('meeting')
          ? 'meeting'
          : 'activity'
    return {
      id: `act_${a.id}`,
      type,
      user: String(a.ownerName || a.createdByName || a.updatedByName || '—'),
      at: asIso(a.activityDate || a.completedAt || a.createdAt || a.updatedAt),
      summary: String(a.subject || a.description || a.outcome || type),
      sourceDocument: String(a.id),
      status: a.status ? String(a.status) : undefined,
    }
  })
}

export function mapFollowUpsToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  return rows.map((f) => ({
    id: `fu_${f.id}`,
    type: 'follow_up' as const,
    user: String(f.assignedToName || f.createdByName || '—'),
    at: asIso(f.completedAt || f.dueDate || f.updatedAt || f.createdAt),
    summary: String(f.notes || f.outcome || f.followUpType || 'Follow-up'),
    sourceDocument: String(f.id),
    status: f.status ? String(f.status) : undefined,
    href: `/(app)/crm/follow-ups`,
  }))
}

export function mapNotesToTimeline(rows: Array<Record<string, unknown>>): UnifiedTimelineEntry[] {
  return rows.map((n) => ({
    id: `note_${n.id}`,
    type: 'note' as const,
    user: String(n.createdByName || '—'),
    at: asIso(n.createdAt || n.updatedAt),
    summary: String(n.content || n.noteType || 'Note').slice(0, 200),
    sourceDocument: String(n.id),
  }))
}

export function mapAttachmentsToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  return rows.map((a) => ({
    id: `file_${a.id}`,
    type: 'attachment' as const,
    user: String(a.uploadedByName || a.createdByName || '—'),
    at: asIso(a.createdAt || a.uploadedAt),
    summary: String(a.originalFilename || a.documentTypeName || 'File'),
    sourceDocument: String(a.id),
    status: a.documentType ? String(a.documentType) : undefined,
  }))
}

export function mapQuotationsToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  const out: UnifiedTimelineEntry[] = []
  for (const q of rows) {
    out.push({
      id: `qt_${q.id}`,
      type: 'quotation',
      user: String(q.salesOwnerName || q.createdByName || '—'),
      at: asIso(q.updatedAt || q.createdAt),
      summary: `Quotation ${q.quotationCode || q.quotationNo || ''}`.trim(),
      sourceDocument: String(q.quotationCode || q.id),
      status: q.status ? String(q.status) : undefined,
      href: `/(app)/crm/quotations/${q.id}`,
    })
    const docs = (q.documents as Array<Record<string, unknown>> | undefined) ?? []
    for (const d of docs) {
      const hist = (d.approvalHistory as Array<Record<string, unknown>> | undefined) ?? []
      if (hist.length) {
        for (const h of hist) {
          out.push({
            id: `qta_${d.id}_${h.at || h.createdAt || h.id}`,
            type: 'quotation_approval',
            user: String(h.byName || h.userName || h.actorName || '—'),
            at: asIso(h.at || h.createdAt || d.updatedAt),
            summary: String(h.action || h.status || 'Approval event'),
            sourceDocument: String(q.quotationCode || q.id),
            status: h.status ? String(h.status) : undefined,
            href: `/(app)/crm/quotations/${q.id}`,
          })
        }
      } else if (d.status && String(d.status).toLowerCase().includes('approv')) {
        out.push({
          id: `qtd_${d.id}`,
          type: 'quotation_approval',
          user: String(d.salesOwnerName || d.createdByName || '—'),
          at: asIso(d.updatedAt || d.createdAt),
          summary: `Document rev ${d.revisionNo ?? ''} · ${d.status}`,
          sourceDocument: String(q.quotationCode || q.id),
          status: String(d.status),
          href: `/(app)/crm/quotations/${q.id}`,
        })
      }
    }
  }
  return out
}

export function mapSalesOrdersToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  return rows.map((s) => ({
    id: `so_${s.id}`,
    type: 'sales_order' as const,
    user: String(s.salesOwnerName || s.createdByName || '—'),
    at: asIso(s.orderDate || s.updatedAt || s.createdAt),
    summary: `Sales order ${s.salesOrderNo || s.soNumber || ''}`.trim(),
    sourceDocument: String(s.salesOrderNo || s.id),
    status: s.status ? String(s.status) : undefined,
    href: `/(app)/crm/sales-orders/${s.id}`,
  }))
}

export function mapPaymentsToTimeline(
  rows: Array<Record<string, unknown>>,
): UnifiedTimelineEntry[] {
  return rows.map((p) => ({
    id: `pay_${p.id || p.openItemId}`,
    type: 'payment' as const,
    user: String(p.createdByName || 'System'),
    at: asIso(p.paymentDate || p.postingDate || p.dueDate || p.createdAt),
    summary: String(
      p.referenceNumber ||
        p.invoiceNumber ||
        p.voucherNumber ||
        `Outstanding ${p.outstandingAmount ?? ''}`,
    ),
    sourceDocument: String(p.invoiceNumber || p.voucherNumber || p.id || ''),
    status: p.status || p.invoiceStatus ? String(p.status || p.invoiceStatus) : undefined,
  }))
}

export function buildUnifiedTimeline(input: {
  activities?: Array<Record<string, unknown>>
  followUps?: Array<Record<string, unknown>>
  notes?: Array<Record<string, unknown>>
  attachments?: Array<Record<string, unknown>>
  quotations?: Array<Record<string, unknown>>
  salesOrders?: Array<Record<string, unknown>>
  payments?: Array<Record<string, unknown>>
  limit?: number
}): UnifiedTimelineEntry[] {
  const merged = [
    ...mapActivitiesToTimeline(input.activities ?? []),
    ...mapFollowUpsToTimeline(input.followUps ?? []),
    ...mapNotesToTimeline(input.notes ?? []),
    ...mapAttachmentsToTimeline(input.attachments ?? []),
    ...mapQuotationsToTimeline(input.quotations ?? []),
    ...mapSalesOrdersToTimeline(input.salesOrders ?? []),
    ...mapPaymentsToTimeline(input.payments ?? []),
  ].filter((e) => e.at)
  const sorted = sortNewestFirst(merged)
  const limit = input.limit ?? 100
  return sorted.slice(0, limit)
}
