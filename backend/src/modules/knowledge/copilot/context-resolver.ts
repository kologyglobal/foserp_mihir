import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'

export type CopilotErpContextInput = {
  moduleKey?: string | null
  routePath: string
  entityType?: string | null
  entityId?: string | null
  screenHints?: string[]
  pageTitle?: string | null
}

export type ResolvedErpContext = {
  routePath: string
  moduleKey: string | null
  entityType: string | null
  entityId: string | null
  pageTitle: string | null
  screenHints: string[]
  /** Human-readable facts the user is allowed to view (never invent). */
  facts: string[]
  /** Permission checks that gated resolution. */
  permissionNotes: string[]
}

function hasPerm(permissions: string[], isSuperAdmin: boolean, name: string): boolean {
  if (isSuperAdmin) return true
  return permissions.includes(name) || permissions.includes('tenant.manage')
}

/**
 * Build a privilege-filtered ERP context block for copilot prompts.
 * Only fields returned after an allowlist permission check are included.
 */
export async function resolveErpContextForCopilot(opts: {
  tenantId: string
  permissions: string[]
  isSuperAdmin: boolean
  context: CopilotErpContextInput
}): Promise<ResolvedErpContext> {
  const { tenantId, permissions, isSuperAdmin } = opts
  const ctx = opts.context
  const routePath = (ctx.routePath || '/').slice(0, 500)
  const moduleKey = ctx.moduleKey?.trim() || inferModuleKey(routePath)
  const entityType = (ctx.entityType?.trim() || inferEntityType(routePath) || null)?.toUpperCase() ?? null
  const entityId = ctx.entityId?.trim() || inferEntityId(routePath) || null
  const screenHints = (ctx.screenHints ?? []).map((h) => h.trim()).filter(Boolean).slice(0, 20)
  const pageTitle = ctx.pageTitle?.trim() || null

  const facts: string[] = [
    `Route: ${routePath}`,
    moduleKey ? `Module: ${moduleKey}` : null,
    pageTitle ? `Page title: ${pageTitle}` : null,
  ].filter((f): f is string => Boolean(f))

  const permissionNotes: string[] = []

  if (entityType && entityId) {
    const resolved = await resolveEntityFacts({
      tenantId,
      permissions,
      isSuperAdmin,
      entityType,
      entityId,
      permissionNotes,
    })
    if (resolved.length) {
      facts.push(`Entity: ${entityType} (${entityId})`)
      facts.push(...resolved)
    } else {
      facts.push(
        `Entity reference ${entityType}/${entityId} was provided but no viewable fields were resolved (missing permission or not found).`,
      )
    }
  }

  for (const hint of screenHints) {
    facts.push(`Screen hint: ${hint}`)
  }

  return {
    routePath,
    moduleKey,
    entityType,
    entityId,
    pageTitle,
    screenHints,
    facts,
    permissionNotes,
  }
}

export function formatResolvedContextForPrompt(resolved: ResolvedErpContext): string {
  const lines = [
    '## Current ERP screen context',
    'Use this only as situational awareness. Prefer knowledge citations for policy/process answers.',
    'Do not invent ERP field values beyond the facts listed.',
    '',
    ...resolved.facts.map((f) => `- ${f}`),
  ]
  if (resolved.permissionNotes.length) {
    lines.push('', '### Permission notes', ...resolved.permissionNotes.map((n) => `- ${n}`))
  }
  return lines.join('\n')
}

function inferModuleKey(path: string): string | null {
  const p = path.toLowerCase()
  if (p.startsWith('/crm') || p.startsWith('/sales')) return 'crm'
  if (p.startsWith('/purchase')) return 'purchase'
  if (p.startsWith('/inventory')) return 'inventory'
  if (p.startsWith('/manufacturing') || p.startsWith('/production')) return 'manufacturing'
  if (p.startsWith('/accounting') || p.startsWith('/finance')) return 'accounting'
  if (p.startsWith('/quality')) return 'quality'
  if (p.startsWith('/maintenance')) return 'maintenance'
  if (p.startsWith('/dispatch') || p.startsWith('/gate') || p.startsWith('/logistics')) return 'dispatch'
  if (p.startsWith('/knowledge')) return 'knowledge'
  if (p.startsWith('/admin')) return 'admin'
  return null
}

function inferEntityType(path: string): string | null {
  const rules: Array<{ re: RegExp; type: string }> = [
    { re: /\/crm\/leads\/[^/]+/i, type: 'LEAD' },
    { re: /\/crm\/opportunities\/[^/]+/i, type: 'OPPORTUNITY' },
    { re: /\/crm\/quotations\/[^/]+/i, type: 'QUOTATION' },
    { re: /\/crm\/sales-orders\/[^/]+/i, type: 'SALES_ORDER' },
    { re: /\/sales\/orders\/[^/]+/i, type: 'SALES_ORDER' },
    { re: /\/crm\/companies\/[^/]+/i, type: 'COMPANY' },
    { re: /\/crm\/contacts\/[^/]+/i, type: 'CONTACT' },
    { re: /\/purchase\/orders\/[^/]+/i, type: 'PURCHASE_ORDER' },
  ]
  for (const r of rules) {
    if (r.re.test(path)) return r.type
  }
  return null
}

function inferEntityId(path: string): string | null {
  const uuid =
    path.match(
      /\/(?:leads|opportunities|quotations|sales-orders|orders|companies|contacts)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1] ?? null
  return uuid
}

async function resolveEntityFacts(opts: {
  tenantId: string
  permissions: string[]
  isSuperAdmin: boolean
  entityType: string
  entityId: string
  permissionNotes: string[]
}): Promise<string[]> {
  const { tenantId, permissions, isSuperAdmin, entityType, entityId, permissionNotes } = opts

  switch (entityType) {
    case 'LEAD': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.lead.view')) {
        permissionNotes.push('crm.lead.view required to load lead fields')
        return []
      }
      const row = await prisma.crmLead.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          leadCode: true,
          prospectName: true,
          companyName: true,
          stage: true,
          lifecycleStatus: true,
          expectedValue: true,
          productRequirement: true,
        },
      })
      if (!row) return []
      return [
        `Lead code: ${row.leadCode}`,
        `Prospect: ${row.prospectName}`,
        row.companyName ? `Company: ${row.companyName}` : null,
        `Stage: ${row.stage}`,
        `Lifecycle: ${row.lifecycleStatus}`,
        row.expectedValue != null ? `Expected value: ${String(row.expectedValue)}` : null,
        row.productRequirement ? `Requirement: ${row.productRequirement.slice(0, 400)}` : null,
      ].filter((f): f is string => Boolean(f))
    }
    case 'OPPORTUNITY': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.opportunity.view')) {
        permissionNotes.push('crm.opportunity.view required to load opportunity fields')
        return []
      }
      const row = await prisma.crmOpportunity.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          opportunityCode: true,
          name: true,
          status: true,
          amount: true,
          stage: { select: { name: true } },
          company: { select: { name: true } },
        },
      })
      if (!row) return []
      return [
        `Opportunity code: ${row.opportunityCode}`,
        `Name: ${row.name}`,
        row.company?.name ? `Customer: ${row.company.name}` : null,
        row.stage?.name ? `Stage: ${row.stage.name}` : null,
        row.status ? `Status: ${row.status}` : null,
        row.amount != null ? `Amount: ${String(row.amount)}` : null,
      ].filter((f): f is string => Boolean(f))
    }
    case 'QUOTATION': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.quotation.view')) {
        permissionNotes.push('crm.quotation.view required to load quotation fields')
        return []
      }
      const row = await prisma.crmQuotation.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          quotationCode: true,
          status: true,
          revisionNo: true,
          company: { select: { name: true } },
          salesOrderNo: true,
        },
      })
      if (!row) return []
      return [
        `Quotation: ${row.quotationCode} rev ${row.revisionNo}`,
        `Customer: ${row.company.name}`,
        `Status: ${row.status}`,
        row.salesOrderNo ? `Linked SO: ${row.salesOrderNo}` : null,
      ].filter((f): f is string => Boolean(f))
    }
    case 'SALES_ORDER': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.sales_order.view')) {
        permissionNotes.push('crm.sales_order.view required to load sales order fields')
        return []
      }
      const row = await prisma.crmSalesOrder.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          salesOrderNo: true,
          status: true,
          grandTotal: true,
          customerPoNumber: true,
          orderDate: true,
          company: { select: { name: true } },
        },
      })
      if (!row) return []
      return [
        `Sales order: ${row.salesOrderNo}`,
        `Customer: ${row.company.name}`,
        `Status: ${row.status}`,
        row.grandTotal != null ? `Grand total: ${String(row.grandTotal)}` : null,
        row.customerPoNumber ? `Customer PO: ${row.customerPoNumber}` : null,
        `Order date: ${row.orderDate.toISOString().slice(0, 10)}`,
      ].filter((f): f is string => Boolean(f))
    }
    case 'COMPANY': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.company.view')) {
        permissionNotes.push('crm.company.view required to load company fields')
        return []
      }
      const row = await prisma.crmCompany.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          companyCode: true,
          name: true,
          industry: true,
          city: true,
          state: true,
        },
      })
      if (!row) return []
      return [
        `Company: ${row.name} (${row.companyCode})`,
        row.industry ? `Industry: ${row.industry}` : null,
        [row.city, row.state].filter(Boolean).length
          ? `Location: ${[row.city, row.state].filter(Boolean).join(', ')}`
          : null,
      ].filter((f): f is string => Boolean(f))
    }
    case 'CONTACT': {
      if (!hasPerm(permissions, isSuperAdmin, 'crm.contact.view')) {
        permissionNotes.push('crm.contact.view required to load contact fields')
        return []
      }
      const row = await prisma.crmContact.findFirst({
        where: { id: entityId, ...tenantActiveFilter(tenantId) },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          designation: true,
          company: { select: { name: true } },
        },
      })
      if (!row) return []
      const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
      return [
        `Contact: ${fullName}`,
        row.company?.name ? `Company: ${row.company.name}` : null,
        row.designation ? `Designation: ${row.designation}` : null,
        row.email ? `Email: ${row.email}` : null,
        row.mobile ? `Mobile: ${row.mobile}` : null,
      ].filter((f): f is string => Boolean(f))
    }
    case 'PURCHASE_ORDER': {
      // Full PO resolve deferred until purchase services are production-gated for AI.
      if (!hasPerm(permissions, isSuperAdmin, 'purchase.po.view')) {
        permissionNotes.push('purchase.po.view noted; PO detail injection not expanded in Wave 5')
      } else {
        permissionNotes.push('PO path detected — detail injection deferred (Wave 5 uses route-only context)')
      }
      return []
    }
    default:
      permissionNotes.push(`Unsupported entityType for detail injection: ${entityType}`)
      return []
  }
}
