import type { CrmMasterEntry, CrmMasterFieldDef, CrmMasterKind, CrmMasterUsedIn, CrmMasterCatalogItem } from '../types/crmMasters'
import { useSalesStore } from '../store/salesStore'
import { useCrmStore } from '../store/crmStore'
import { useMasterStore } from '../store/masterStore'
import { getCrmMasterCatalog } from '../config/crmMastersCatalog'

export interface CrmMasterUsageLink {
  label: string
  route: string
  count: number
}

export function getMasterUsageLinks(entry: CrmMasterEntry): CrmMasterUsageLink[] {
  const { kind, code } = entry
  const sales = useSalesStore.getState()
  const crm = useCrmStore.getState()
  const masters = useMasterStore.getState()
  const links: CrmMasterUsageLink[] = []

  const push = (label: string, route: string, count: number) => {
    if (count > 0) links.push({ label, route, count })
  }

  if (kind === 'lead-stages') {
    const n = sales.leads.filter((l) => l.stage === code).length
    push('Leads', `/crm/leads?stage=${encodeURIComponent(code)}`, n)
  }
  if (kind === 'lead-priorities') {
    const n = sales.leads.filter((l) => l.priority === code).length
    push('Leads', `/crm/leads?priority=${encodeURIComponent(code)}`, n)
  }
  if (kind === 'lead-sources') {
    const n = sales.leads.filter((l) => l.source === code).length
    push('Leads', `/crm/leads?source=${encodeURIComponent(code)}`, n)
    const cn = masters.customers.filter((c) => (c as { source?: string }).source === code).length
    push('Companies', `/crm/customers?source=${encodeURIComponent(code)}`, cn)
  }
  if (kind === 'industries') {
    const n = sales.leads.filter((l) => l.industry === code || l.industry === entry.name).length
    push('Leads', `/crm/leads?industry=${encodeURIComponent(code)}`, n)
    const cn = masters.customers.filter((c) => c.industry === code || c.industry === entry.name).length
    push('Companies', `/crm/customers?industry=${encodeURIComponent(code)}`, cn)
  }
  if (kind === 'designations') {
    const n = crm.contacts.filter((c) => c.designation === code || c.designation === entry.name).length
    push('Contacts', `/crm/contacts?designation=${encodeURIComponent(entry.name)}`, n)
  }
  if (kind === 'departments') {
    const n = crm.contacts.filter((c) => c.department === code || c.department === entry.name).length
    push('Contacts', `/crm/contacts?department=${encodeURIComponent(entry.name)}`, n)
  }
  if (kind === 'owners') {
    push('Leads', `/crm/leads?owner=${encodeURIComponent(code)}`, sales.leads.filter((l) => l.leadOwnerId === code).length)
    push('Opportunities', `/crm/opportunities?owner=${encodeURIComponent(code)}`, crm.opportunities.filter((o) => o.ownerId === code).length)
  }
  if (kind === 'activity-types') {
    push('Leads', `/crm/leads?followUpType=${encodeURIComponent(code)}`, sales.leads.filter((l) => l.followUpType === code).length)
    push('Follow-ups', `/crm/opportunities?view=follow-ups&type=${encodeURIComponent(code)}`, crm.followUps.filter((f) => f.followUpType === code).length)
  }
  if (kind === 'lead-reasons') {
    const cat = String(entry.attributes.category)
    if (cat === 'inactive') push('Leads', `/crm/leads?inactiveReason=${encodeURIComponent(code)}`, sales.leads.filter((l) => l.inactiveReason === code).length)
    if (cat === 'closed') push('Leads', `/crm/leads?closedReason=${encodeURIComponent(code)}`, sales.leads.filter((l) => l.closedReason === code).length)
    if (cat === 'not_qualified') push('Leads', `/crm/leads?notQualifiedReason=${encodeURIComponent(code)}`, sales.leads.filter((l) => l.notQualifiedReason === code).length)
  }
  if (kind === 'opportunity-stages') {
    push('Opportunities', `/crm/opportunities?stage=${encodeURIComponent(code)}`, crm.opportunities.filter((o) => o.stage === code).length)
  }
  if (kind === 'territories') {
    push('Companies', `/crm/customers?territory=${encodeURIComponent(code)}`, masters.customers.filter((c) => c.salesTerritory === code || c.salesTerritory === entry.name).length)
  }
  if (kind === 'lost-reasons') {
    push('Opportunities', `/crm/opportunities?lostReason=${encodeURIComponent(code)}`, crm.opportunities.filter((o) => o.lostReason === code).length)
  }

  return links
}

export function usedInRoutes(usedIn: CrmMasterUsedIn[] | undefined): { label: string; route: string }[] {
  const map: Record<CrmMasterUsedIn, { label: string; route: string }> = {
    leads: { label: 'Leads', route: '/crm/leads' },
    opportunities: { label: 'Opportunities', route: '/crm/opportunities' },
    quotations: { label: 'Quotations', route: '/crm/quotations' },
    'sales-orders': { label: 'Sales Orders', route: '/crm/sales-orders' },
    invoices: { label: 'Invoices', route: '/invoice' },
    companies: { label: 'Companies', route: '/crm/companies' },
    contacts: { label: 'Contacts', route: '/crm/contacts' },
    customer360: { label: 'Customer 360', route: '/entity360/customers' },
    reports: { label: 'CRM Reports', route: '/crm/reports' },
  }
  return (usedIn ?? []).map((k) => map[k])
}

export function getCatalogUsedIn(kind: CrmMasterKind) {
  return getCrmMasterCatalog(kind)?.usedIn
}

export function parseMastersCsv(text: string): Array<{ code: string; name: string; status?: string; description?: string }> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())
  const codeIdx = headers.indexOf('code')
  const nameIdx = headers.indexOf('name')
  if (codeIdx < 0 || nameIdx < 0) return []
  const statusIdx = headers.indexOf('status')
  const descIdx = headers.indexOf('description')
  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
    return {
      code: cols[codeIdx] ?? '',
      name: cols[nameIdx] ?? '',
      status: statusIdx >= 0 ? cols[statusIdx] : 'active',
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    }
  }).filter((r) => r.code && r.name)
}

export function exportMastersExcelTsv(entries: CrmMasterEntry[]): string {
  const header = ['Code', 'Name', 'Status', 'Sort Order', 'Description', 'Notes', 'Attributes']
  const rows = entries.map((e) => [
    e.code,
    e.name,
    e.status,
    String(e.sortOrder),
    e.description ?? '',
    e.notes ?? '',
    JSON.stringify(e.attributes),
  ])
  return [header, ...rows].map((r) => r.join('\t')).join('\n')
}

export function printMasterTable(title: string, entries: CrmMasterEntry[]) {
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:Segoe UI,sans-serif;font-size:12px;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f4f6}</style></head>
<body><h1>${title}</h1><p>Printed ${new Date().toLocaleString('en-IN')}</p>
<table><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Sort</th></tr></thead><tbody>
${entries.map((e) => `<tr><td>${e.code}</td><td>${e.name}</td><td>${e.status}</td><td>${e.sortOrder}</td></tr>`).join('')}
</tbody></table></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.print()
}


export function sortMasterEntries(entries: CrmMasterEntry[]): CrmMasterEntry[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function masterEntryLabel(entry: CrmMasterEntry | undefined, fallback = '—'): string {
  return entry?.name ?? fallback
}

export function filterActiveMasters(entries: CrmMasterEntry[], includeInactive = false): CrmMasterEntry[] {
  if (includeInactive) return sortMasterEntries(entries)
  return sortMasterEntries(entries.filter((e) => e.status === 'active'))
}

export function getLeadReasonCategoryEntries(
  entries: CrmMasterEntry[],
  category: 'inactive' | 'closed' | 'not_qualified',
  activeOnly = true,
): CrmMasterEntry[] {
  const filtered = entries.filter(
    (e) => e.kind === 'lead-reasons' && String(e.attributes.category) === category,
  )
  return filterActiveMasters(filtered, !activeOnly)
}

export function countMasterUsage(entry: CrmMasterEntry): number {
  const { kind, code } = entry
  const sales = useSalesStore.getState()
  const crm = useCrmStore.getState()
  const masters = useMasterStore.getState()
  let count = 0

  if (kind === 'lead-stages') {
    count += sales.leads.filter((l) => l.stage === code).length
  }
  if (kind === 'lead-priorities') {
    count += sales.leads.filter((l) => l.priority === code).length
  }
  if (kind === 'lead-sources') {
    count += sales.leads.filter((l) => l.source === code).length
    count += masters.customers.filter((c) => (c as { source?: string }).source === code).length
  }
  if (kind === 'industries') {
    count += sales.leads.filter((l) => l.industry === code || l.industry === entry.name).length
    count += masters.customers.filter((c) => c.industry === code || c.industry === entry.name).length
  }
  if (kind === 'designations') {
    count += crm.contacts.filter((c) => c.designation === code || c.designation === entry.name).length
  }
  if (kind === 'departments') {
    count += crm.contacts.filter((c) => c.department === code || c.department === entry.name).length
  }
  if (kind === 'owners') {
    count += sales.leads.filter((l) => l.leadOwnerId === code).length
    count += crm.opportunities.filter((o) => o.ownerId === code).length
  }
  if (kind === 'activity-types') {
    count += sales.leads.filter((l) => l.followUpType === code).length
    count += crm.followUps.filter((f) => f.followUpType === code).length
  }
  if (kind === 'lead-reasons') {
    const cat = String(entry.attributes.category)
    if (cat === 'inactive') count += sales.leads.filter((l) => l.inactiveReason === code).length
    if (cat === 'closed') count += sales.leads.filter((l) => l.closedReason === code).length
    if (cat === 'not_qualified') count += sales.leads.filter((l) => l.notQualifiedReason === code).length
  }
  if (kind === 'opportunity-stages') {
    count += crm.opportunities.filter((o) => o.stage === code).length
  }
  if (kind === 'territories') {
    count += masters.customers.filter((c) => c.salesTerritory === code || c.salesTerritory === entry.name).length
  }

  return count
}

export function canDeleteMasterEntry(entry: CrmMasterEntry): { ok: boolean; reason?: string } {
  if (entry.systemControlled) {
    return { ok: false, reason: 'System-controlled master values cannot be deleted.' }
  }
  const usage = countMasterUsage(entry)
  if (usage > 0) {
    return {
      ok: false,
      reason: 'This master value is used in CRM records. You can deactivate it for future use.',
    }
  }
  return { ok: true }
}

export function exportMastersCsv(entries: CrmMasterEntry[]): string {
  const header = ['id', 'kind', 'code', 'name', 'status', 'sortOrder', 'description', 'attributes']
  const rows = entries.map((e) => [
    e.id,
    e.kind,
    e.code,
    e.name,
    e.status,
    String(e.sortOrder),
    e.description ?? '',
    JSON.stringify(e.attributes),
  ])
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

const CRM_MASTER_CORE_BASIC_KEYS = new Set(['code', 'name', 'status'])

export type CrmMasterFieldSection = 'basic' | 'description' | 'configuration' | 'notes'

export function resolveCrmMasterFieldSection(field: CrmMasterFieldDef): CrmMasterFieldSection {
  if (field.section === 'reference') return 'configuration'
  if (field.section) return field.section
  if (CRM_MASTER_CORE_BASIC_KEYS.has(field.key)) return 'basic'
  if (field.key === 'description') return 'description'
  if (field.key === 'notes') return 'notes'
  return 'configuration'
}

export function crmMasterBasicExtraFields(catalog: CrmMasterCatalogItem): CrmMasterFieldDef[] {
  return catalog.fields.filter(
    (f) => resolveCrmMasterFieldSection(f) === 'basic' && !CRM_MASTER_CORE_BASIC_KEYS.has(f.key),
  )
}

export function crmMasterConfigurationFields(catalog: CrmMasterCatalogItem): CrmMasterFieldDef[] {
  return catalog.fields.filter((f) => resolveCrmMasterFieldSection(f) === 'configuration')
}

export function crmMasterShowsNotes(catalog: CrmMasterCatalogItem): boolean {
  return catalog.showNotes !== false
}

export function crmMasterShowsDescription(catalog: CrmMasterCatalogItem): boolean {
  return catalog.showDescription !== false
}

export function crmMasterBasicSectionLabel(catalog: CrmMasterCatalogItem): string {
  return catalog.basicSectionLabel ?? 'Basic'
}

export function crmMasterConfigurationSectionLabel(catalog: CrmMasterCatalogItem): string {
  return catalog.configurationSectionLabel ?? 'Configuration'
}

const DRAWER_CORE_KEYS = new Set(['code', 'name', 'status', 'description', 'notes'])

/**
 * Small masters open in a drawer; complex masters (many/extra field types) use the full page form.
 * Catalog `formPresentation` overrides the heuristic.
 */
export function crmMasterPrefersDrawerForm(catalog: CrmMasterCatalogItem): boolean {
  if (catalog.formPresentation === 'drawer') return true
  if (catalog.formPresentation === 'page') return false
  if (catalog.descriptionFormat === 'richtext') return false
  const extras = catalog.fields.filter((f) => !DRAWER_CORE_KEYS.has(f.key))
  if (extras.some((f) => f.type === 'multiselect' || f.type === 'richtext')) return false
  if (extras.length > 3) return false
  return true
}

/** Show Effective Date when the catalog defines that field. */
export function crmMasterHasEffectiveDate(catalog: CrmMasterCatalogItem): boolean {
  return catalog.fields.some((f) => f.key === 'effectiveDate')
}

export function slugToKind(slug: string): CrmMasterKind | null {
  if (slug === 'users') return 'owners'
  const valid: CrmMasterKind[] = [
    'lead-sources', 'industries', 'territories', 'designations', 'departments', 'lead-stages', 'lead-priorities',
    'lead-reasons', 'opportunity-stages', 'opportunity-priorities', 'activity-types',
    'product-interests', 'lost-reasons', 'commercial-terms',
    'payment-terms', 'delivery-terms', 'warranty-terms', 'approval-rules', 'document-types',
  ]
  return valid.includes(slug as CrmMasterKind) ? (slug as CrmMasterKind) : null
}
