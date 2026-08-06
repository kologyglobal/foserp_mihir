import type { AppNotification, AppNotificationPriority } from '@/services/api/notificationsApi'

export type NotificationContext = {
  company: string | null
  contact: string | null
  recordCode: string | null
  recordKind: string | null
  dueTime: string | null
  dueDate: string | null
  notes: string | null
  followUpType: string | null
  /** Clean one-line summary when structured fields cover message detail. */
  shortSummary: string | null
  /** Full message only when metadata is sparse (legacy / simple alerts). */
  bodyMessage: string | null
}

function metaStr(m: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!m) return null
  const v = m[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function humanizeToken(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Infer document kind from code patterns and dense legacy messages. */
function inferRecordKind(message: string, code: string | null): string | null {
  if (!code) return null
  const m = message.match(
    new RegExp(
      `\\b(Lead|Opportunity|Company|Quotation|PR|PO|GRN|RFQ|Invoice)\\s+${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    ),
  )
  if (m?.[1]) {
    const t = m[1]
    if (t === 'PR') return 'Requisition'
    if (t === 'PO') return 'Purchase order'
    if (t === 'GRN') return 'Goods receipt'
    if (t === 'RFQ') return 'RFQ'
    return t
  }
  if (/^LEAD[-_]/i.test(code)) return 'Lead'
  if (/^OPP[-_]/i.test(code)) return 'Opportunity'
  if (/^QT[-_]/i.test(code) || /^QUO/i.test(code)) return 'Quotation'
  if (/^PR[-_]/i.test(code)) return 'Requisition'
  if (/^PO[-_]/i.test(code)) return 'Purchase order'
  if (/^GRN[-_]/i.test(code)) return 'Goods receipt'
  if (/^RFQ[-_]/i.test(code)) return 'RFQ'
  if (/^PINV[-_]/i.test(code) || /^PI[-_]/i.test(code)) return 'Invoice'
  return null
}

/**
 * Prefer structured metadata over the dense "a · b · c" message body
 * so the UI can render scannable rows instead of walls of text.
 */
export function getNotificationContext(n: AppNotification): NotificationContext {
  const meta = n.metadata
  const company = metaStr(meta, 'companyName') ?? n.entityName
  const contact = metaStr(meta, 'contactName')
  const recordCode = metaStr(meta, 'recordCode') ?? n.entityCode
  const dueTime = metaStr(meta, 'dueTime')
  const dueDate = metaStr(meta, 'dueDate')
  const notes = metaStr(meta, 'notesSnippet')
  const followUpType = metaStr(meta, 'followUpType')
  const recordKind = inferRecordKind(n.message, recordCode)

  const hasStructure = Boolean(company || contact || recordCode || notes || dueTime || dueDate)

  let shortSummary: string | null = null
  if (hasStructure) {
    // Title already says "Call due today" / "Email overdue" — add time only when helpful
    if (dueTime && !n.title.toLowerCase().includes(dueTime.toLowerCase())) {
      shortSummary = `Scheduled at ${dueTime}`
    } else if (dueDate && !n.title.toLowerCase().includes('today') && !n.title.toLowerCase().includes('overdue')) {
      shortSummary = `Due ${dueDate}`
    }
  }

  // Drop dense multi-part messages when we already have structured chips
  const bodyMessage =
    hasStructure && n.message.includes(' · ')
      ? null
      : n.message && n.message !== n.title
        ? n.message
        : null

  return {
    company: company && company !== n.title ? company : null,
    contact: contact && contact !== company ? contact : null,
    recordCode,
    recordKind,
    dueTime,
    dueDate,
    notes,
    followUpType,
    shortSummary,
    bodyMessage,
  }
}

export function priorityLabel(p: AppNotificationPriority | string): string {
  if (p === 'CRITICAL') return 'Critical'
  if (p === 'HIGH') return 'High'
  if (p === 'POSITIVE') return 'Positive'
  if (p === 'LOW') return 'Low'
  return 'Normal'
}

export function priorityTone(p: string): 'red' | 'amber' | 'green' | 'grey' {
  if (p === 'CRITICAL') return 'red'
  if (p === 'HIGH') return 'amber'
  if (p === 'POSITIVE') return 'green'
  return 'grey'
}

/** Soft badge classes matched to ERP status tokens. */
export function priorityBadgeClass(p: string): string {
  if (p === 'CRITICAL') return 'bg-erp-danger-soft text-erp-danger-fg ring-erp-danger/25'
  if (p === 'HIGH') return 'bg-erp-warning-soft text-erp-warning-fg ring-erp-warning/25'
  if (p === 'POSITIVE') return 'bg-erp-success-soft text-erp-success-fg ring-erp-success/25'
  return 'bg-erp-surface-alt text-erp-muted ring-erp-border/60'
}

export function categoryLabel(category: string): string {
  return humanizeToken(category) ?? category
}

export function categoryShort(category: string): string {
  const c = category.toUpperCase()
  if (c === 'FOLLOW_UP') return 'Follow-up'
  if (c === 'APPROVAL') return 'Approval'
  if (c === 'MEETING') return 'Meeting'
  if (c === 'RISK') return 'Risk'
  if (c === 'INTEGRATION') return 'System'
  if (c === 'ASSIGNMENT') return 'Assignment'
  return humanizeToken(category) ?? category
}
