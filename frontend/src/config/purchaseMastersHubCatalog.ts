import { ShoppingCart } from 'lucide-react'
import {
  PURCHASE_LINKED_MASTERS,
  PURCHASE_MASTERS_CATALOG,
} from './purchaseMastersCatalog'
import { ALL_MASTER_DEFINITIONS } from './masterModuleStructure'
import type { MasterSetupLink } from './mastersSetupCatalog'

export const PURCHASE_MASTER_HUB_GROUP_LABELS: Record<string, string> = {
  vendor: 'Vendor & Sourcing',
  item: 'Item & Receipt',
  terms: 'Commercial Terms',
  receiving: 'Receiving & QC',
  governance: 'Procurement Governance',
}

export const PURCHASE_MASTER_HUB_GROUP_ORDER = [
  'vendor',
  'item',
  'terms',
  'receiving',
  'governance',
] as const

/** Count keys for linked registers — reuse global / CRM hub counts */
const LINKED_COUNT_KEYS: Record<string, string | undefined> = {
  vendors: 'vendors',
  items: 'items',
  'item-categories': 'categories',
  warehouses: 'warehouses',
  locations: 'locations',
  uom: 'uoms',
  'payment-terms': 'paymentTerms',
  'delivery-terms': 'crm-delivery-terms',
  'approval-matrix': undefined,
  'qc-parameters': undefined,
  'inspection-plans': undefined,
}

/**
 * Canonical paths already listed under Inventory / other Master Data groups
 * (or CRM / Quality). Purchase-linked shortcuts to these are omitted from the
 * Masters Data index — Purchase Masters hub still shows them.
 */
const CANONICAL_MASTER_PATHS = new Set([
  ...ALL_MASTER_DEFINITIONS.map((d) => d.path),
  '/masters/payment-terms',
  '/crm/masters/delivery-terms',
  '/crm/masters/warranty-terms',
  '/masters/approval-workflows',
  '/quality/parameters',
  '/quality/inspection-plans',
])

export const PURCHASE_MASTERS_SECTION = {
  id: 'purchase' as const,
  title: 'Purchase',
  description: 'Purchase-specific registers — linked Item/Vendor/UOM shortcuts live on Purchase Masters hub only',
  icon: ShoppingCart,
  accent: 'amber' as const,
}

function purchaseHubPath(slug: string): string {
  return `/purchase/masters/${slug}`
}

function purchaseCatalogLink(
  catalog: (typeof PURCHASE_MASTERS_CATALOG)[number],
  subsection: string,
): MasterSetupLink {
  return {
    label: catalog.title,
    path: purchaseHubPath(catalog.slug),
    description: catalog.description,
    countKey: `purchase-${catalog.slug}`,
    groupId: 'purchase',
    status: 'implemented',
    subsection,
    slug: catalog.slug,
  }
}

function purchaseLinkedLink(
  linked: (typeof PURCHASE_LINKED_MASTERS)[number],
  subsection: string,
): MasterSetupLink {
  return {
    label: linked.title,
    path: purchaseHubPath(linked.slug),
    description: linked.description,
    countKey: LINKED_COUNT_KEYS[linked.slug],
    groupId: 'purchase',
    status: linked.sourceModule === 'global' || linked.sourceModule === 'crm' ? 'linked' : 'implemented',
    subsection,
    slug: linked.slug,
  }
}

/**
 * Masters Data index — skip purchase-linked rows when the canonical register
 * already exists (e.g. Item Master under Inventory). Purchase-owned catalogs
 * (freight-terms, buyers, qc-rules, …) remain. Hub page still lists all links.
 */
export function buildPurchaseMasterSetupLinks(): MasterSetupLink[] {
  const links: MasterSetupLink[] = []
  const seen = new Set<string>()

  function push(link: MasterSetupLink) {
    if (seen.has(link.path)) return
    seen.add(link.path)
    links.push(link)
  }

  for (const group of PURCHASE_MASTER_HUB_GROUP_ORDER) {
    const subsection = PURCHASE_MASTER_HUB_GROUP_LABELS[group]

    for (const linked of PURCHASE_LINKED_MASTERS.filter((m) => m.group === group)) {
      if (CANONICAL_MASTER_PATHS.has(linked.listRoute)) continue
      push(purchaseLinkedLink(linked, subsection))
    }

    for (const catalog of PURCHASE_MASTERS_CATALOG.filter((m) => m.group === group)) {
      push(purchaseCatalogLink(catalog, subsection))
    }
  }

  return links
}

export function purchaseMasterCountKey(slug: string): string {
  return `purchase-${slug}`
}
