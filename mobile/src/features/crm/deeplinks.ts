/**
 * Deep link + notification route resolver.
 * Scheme: fos-erp://crm/... or https://host/crm/...
 *
 * Non-CRM URLs (home reload, Expo group routes, auth) must return null so
 * DeepLinkBridge does not force-navigate to /crm/unavailable.
 */

export type DeepLinkTarget =
  | { kind: 'lead'; id: string }
  | { kind: 'company'; id: string }
  | { kind: 'contact'; id: string }
  | { kind: 'follow_up'; id: string }
  | { kind: 'quotation'; id: string }
  | { kind: 'sales_order'; id: string }
  | { kind: 'approval'; id: string }
  /** Pre-resolved Expo Router href for list/create/utility screens */
  | { kind: 'screen'; href: string }
  | { kind: 'unavailable'; reason: string; retryUrl?: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

function isCustomScheme(protocol: string): boolean {
  const p = protocol.replace(/:$/, '').toLowerCase()
  return p === 'fos-erp' || p === 'fos' || p.startsWith('fos')
}

/** Expo / shell segments that are never CRM record deep links. */
const NON_CRM_SEGMENTS = new Set([
  '(tabs)',
  'tabs',
  'index',
  'login',
  'auth',
  '(auth)',
  'profile',
  'settings',
  'unavailable',
])

/**
 * Split a URL or path into CRM path segments after optional prefixes.
 * Returns null when the URL clearly is not a CRM deep link.
 */
export function extractCrmPathParts(url: string): string[] | null {
  if (!url || !url.trim()) return null

  let path = url.trim()
  let custom = false
  try {
    if (path.includes('://')) {
      const u = new URL(path)
      custom = isCustomScheme(u.protocol)
      path = u.pathname + u.search
      // fos-erp://crm/leads/id → host=crm, pathname=/leads/id
      if (custom && u.host && !path.startsWith(`/${u.host}`)) {
        path = `/${u.host}${u.pathname}`
      }
    }
  } catch {
    // treat as raw path
  }

  // Drop query/hash for segment parsing
  path = path.split('?')[0]?.split('#')[0] ?? path
  path = path.replace(/^\/+/, '').replace(/\/+$/, '')
  const parts = path.split('/').filter(Boolean)

  while (parts[0] === 'app' || parts[0] === 'm' || parts[0] === '(app)') {
    parts.shift()
  }
  if (parts[0] === 't' && parts[1]) {
    parts.shift()
    parts.shift()
  }

  const crmIdx = parts.findIndex((p) => p.toLowerCase() === 'crm')
  if (crmIdx >= 0) {
    return parts.slice(crmIdx + 1)
  }

  // Custom scheme without "crm" host still may look like leads/...
  if (custom && parts.length > 0) {
    const head = parts[0]?.toLowerCase() ?? ''
    if (NON_CRM_SEGMENTS.has(head) || head.startsWith('(')) return null
    return parts
  }

  // http(s) or relative path with no /crm → not a deep link (e.g. web home "/")
  return null
}

/**
 * Parse known CRM deep-link patterns into a navigable target.
 * Returns null when the app should leave routing alone (normal open / reload).
 */
export function parseCrmDeepLink(url: string): DeepLinkTarget | null {
  const parts = extractCrmPathParts(url)
  if (parts === null) return null

  // /crm or /crm/ only — nothing to open
  if (parts.length === 0) {
    return null
  }

  const [entityRaw, idRaw, ...rest] = parts
  const entity = (entityRaw ?? '').toLowerCase()
  const id = idRaw

  if (NON_CRM_SEGMENTS.has(entity) || entity.startsWith('(')) {
    return null
  }

  // Utility / list screens (no UUID required)
  if (entity === 'search') return { kind: 'screen', href: '/(app)/crm/search' }
  if (entity === 'collection') return { kind: 'screen', href: '/(app)/crm/collection' }
  if (entity === 'notifications') return { kind: 'screen', href: '/(app)/crm/notifications' }
  if (entity === 'opportunities' || entity === 'opportunity') {
    return { kind: 'screen', href: '/(app)/crm/opportunities' }
  }
  if (entity === 'business-card' || entity === 'business_card') {
    return { kind: 'screen', href: '/(app)/crm/business-card' }
  }

  if (entity === 'approvals' || entity === 'approval') {
    const aid = id || rest[0] || 'list'
    if (aid === 'list') return { kind: 'approval', id: 'list' }
    if (!isUuid(aid)) {
      return { kind: 'unavailable', reason: 'Invalid approval id', retryUrl: url }
    }
    return { kind: 'approval', id: aid }
  }

  // Create routes
  if (id === 'create' || id === 'new') {
    if (entity === 'leads' || entity === 'lead') {
      return { kind: 'screen', href: '/(app)/crm/leads/create' }
    }
    if (entity === 'companies' || entity === 'company' || entity === 'customers') {
      return { kind: 'screen', href: '/(app)/crm/companies/create' }
    }
    if (entity === 'follow-ups' || entity === 'follow_ups' || entity === 'followups') {
      return { kind: 'screen', href: '/(app)/crm/follow-ups/create' }
    }
    if (entity === 'meetings' || entity === 'meeting' || entity === 'activities') {
      return { kind: 'screen', href: '/(app)/crm/meetings/create' }
    }
  }

  // List routes (entity only)
  if (!id) {
    if (entity === 'leads' || entity === 'lead') {
      return { kind: 'screen', href: '/(app)/crm/leads' }
    }
    if (entity === 'companies' || entity === 'company' || entity === 'customers') {
      return { kind: 'screen', href: '/(app)/(tabs)/customers' }
    }
    if (entity === 'follow-ups' || entity === 'follow_ups' || entity === 'followups') {
      return { kind: 'screen', href: '/(app)/crm/follow-ups' }
    }
    if (entity === 'quotations' || entity === 'quotation' || entity === 'quotes') {
      return { kind: 'screen', href: '/(app)/crm/quotations' }
    }
    if (
      entity === 'sales-orders' ||
      entity === 'sales_orders' ||
      entity === 'salesorders' ||
      entity === 'so'
    ) {
      return { kind: 'screen', href: '/(app)/crm/sales-orders' }
    }
    if (entity === 'meetings' || entity === 'meeting' || entity === 'activities') {
      return { kind: 'screen', href: '/(app)/crm/meetings/create' }
    }
    // Unknown entity without id — only show unavailable for explicit deep-link schemes later
    return {
      kind: 'unavailable',
      reason: `Unknown CRM path: ${entity}`,
      retryUrl: url,
    }
  }

  if (id === 'list') {
    if (entity === 'leads' || entity === 'lead') {
      return { kind: 'screen', href: '/(app)/crm/leads' }
    }
    if (entity === 'follow-ups' || entity === 'follow_ups' || entity === 'followups') {
      return { kind: 'screen', href: '/(app)/crm/follow-ups' }
    }
  }

  // PDF deep links: /crm/pdf/{type}/{id}
  if (entity === 'pdf' && id && rest[0]) {
    if (!isUuid(rest[0])) {
      return { kind: 'unavailable', reason: 'Invalid PDF record id', retryUrl: url }
    }
    return {
      kind: 'screen',
      href: `/(app)/crm/pdf/${encodeURIComponent(id)}/${rest[0]}`,
    }
  }

  if (!isUuid(id)) {
    return {
      kind: 'unavailable',
      reason: 'Invalid record id',
      retryUrl: url,
    }
  }

  if (entity === 'leads' || entity === 'lead') return { kind: 'lead', id }
  if (entity === 'companies' || entity === 'company' || entity === 'customers') {
    return { kind: 'company', id }
  }
  if (entity === 'contacts' || entity === 'contact') return { kind: 'contact', id }
  if (entity === 'follow-ups' || entity === 'follow_ups' || entity === 'followups') {
    return { kind: 'follow_up', id }
  }
  if (entity === 'quotations' || entity === 'quotation' || entity === 'quotes') {
    return { kind: 'quotation', id }
  }
  if (
    entity === 'sales-orders' ||
    entity === 'sales_orders' ||
    entity === 'salesorders' ||
    entity === 'so'
  ) {
    return { kind: 'sales_order', id }
  }

  return {
    kind: 'unavailable',
    reason: `Unknown deep link: ${entity}`,
    retryUrl: url,
  }
}

export function deepLinkToHref(target: DeepLinkTarget): string {
  switch (target.kind) {
    case 'lead':
      return `/(app)/crm/leads/${target.id}`
    case 'company':
      return `/(app)/crm/companies/${target.id}`
    case 'contact':
      return `/(app)/crm/contacts/${target.id}`
    case 'follow_up':
      return '/(app)/crm/follow-ups'
    case 'quotation':
      return `/(app)/crm/quotations/${target.id}`
    case 'sales_order':
      return `/(app)/crm/sales-orders/${target.id}`
    case 'approval':
      return '/(app)/(tabs)/approvals'
    case 'screen':
      return target.href
    case 'unavailable': {
      const q = new URLSearchParams()
      q.set('reason', target.reason)
      if (target.retryUrl) q.set('retry', target.retryUrl)
      return `/(app)/crm/unavailable?${q.toString()}`
    }
    default:
      return '/(app)/crm/unavailable?reason=Unknown'
  }
}

/**
 * Resolve a notification / Linking URL to an Expo href.
 * Returns null when the URL is not a CRM deep link (caller must not navigate).
 */
export function handleNotificationDeepLink(url: string): string | null {
  const target = parseCrmDeepLink(url)
  if (!target) return null
  return deepLinkToHref(target)
}
