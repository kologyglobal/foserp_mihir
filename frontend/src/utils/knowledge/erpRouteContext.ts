import type { CopilotErpContextPayload } from '@/services/api/knowledgeApi'

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

type Rule = {
  re: RegExp
  moduleKey: string
  entityType: string
  /** Capture group index for entity id (1-based). */
  idGroup?: number
}

const RULES: Rule[] = [
  { re: /^\/crm\/leads\/([^/]+)/i, moduleKey: 'crm', entityType: 'LEAD', idGroup: 1 },
  {
    re: /^\/crm\/opportunities\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'OPPORTUNITY',
    idGroup: 1,
  },
  {
    re: /^\/crm\/quotations\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'QUOTATION',
    idGroup: 1,
  },
  {
    re: /^\/crm\/sales-orders\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'SALES_ORDER',
    idGroup: 1,
  },
  {
    re: /^\/sales\/orders\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'SALES_ORDER',
    idGroup: 1,
  },
  {
    re: /^\/crm\/companies\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'COMPANY',
    idGroup: 1,
  },
  {
    re: /^\/crm\/contacts\/([^/]+)/i,
    moduleKey: 'crm',
    entityType: 'CONTACT',
    idGroup: 1,
  },
  {
    re: /^\/purchase\/orders\/([^/]+)/i,
    moduleKey: 'purchase',
    entityType: 'PURCHASE_ORDER',
    idGroup: 1,
  },
  { re: /^\/crm(\/|$)/i, moduleKey: 'crm', entityType: '' },
  { re: /^\/sales(\/|$)/i, moduleKey: 'crm', entityType: '' },
  { re: /^\/purchase(\/|$)/i, moduleKey: 'purchase', entityType: '' },
  { re: /^\/inventory(\/|$)/i, moduleKey: 'inventory', entityType: '' },
  { re: /^\/manufacturing(\/|$)/i, moduleKey: 'manufacturing', entityType: '' },
  { re: /^\/accounting(\/|$)/i, moduleKey: 'accounting', entityType: '' },
  { re: /^\/knowledge(\/|$)/i, moduleKey: 'knowledge', entityType: '' },
]

/**
 * Derive copilot ERP context from the current SPA pathname + optional document title.
 */
export function buildCopilotContextFromLocation(
  pathname: string,
  pageTitle?: string | null,
): CopilotErpContextPayload {
  const path = pathname || '/'
  let moduleKey: string | null = null
  let entityType: string | null = null
  let entityId: string | null = null
  const screenHints: string[] = []

  for (const rule of RULES) {
    const m = path.match(rule.re)
    if (!m) continue
    moduleKey = rule.moduleKey
    if (rule.entityType) {
      entityType = rule.entityType
      const raw = rule.idGroup ? m[rule.idGroup] : null
      if (raw && UUID_RE.test(raw)) {
        entityId = raw
      } else if (raw && raw !== 'new' && raw !== 'create') {
        // still pass through non-uuid for backend notes
        entityId = raw
        screenHints.push(`Path segment: ${raw}`)
      }
    }
    break
  }

  if (!moduleKey) {
    const seg = path.split('/').filter(Boolean)[0]
    if (seg) moduleKey = seg
  }

  return {
    moduleKey,
    routePath: path,
    entityType,
    entityId,
    pageTitle: pageTitle?.trim() || (typeof document !== 'undefined' ? document.title : null),
    screenHints: screenHints.length ? screenHints : undefined,
  }
}
