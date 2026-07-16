import { Handshake } from 'lucide-react'
import { CRM_LINKED_MASTERS, CRM_MASTERS_CATALOG } from './crmMastersCatalog'
import {
  PRODUCT_INTEREST_MASTER_CATALOG,
  USER_MASTER_CATALOG,
} from './globalMastersCatalog'
import { MASTER_DATA_CRM_SLUGS } from './masterModuleStructure'
import type { CrmMasterCatalogItem } from '../types/crmMasters'
import type { MasterSetupLink } from './mastersSetupCatalog'

/** CRM catalog group labels — same order as CrmMastersHubPage */
export const CRM_MASTER_HUB_GROUP_LABELS: Record<string, string> = {
  company: 'Company & Account',
  pipeline: 'Pipeline & Ownership',
  communication: 'Engagement',
  quotation: 'Quotation & Terms',
  governance: 'Governance & Documents',
}

export const CRM_MASTER_HUB_GROUP_ORDER = [
  'company',
  'pipeline',
  'communication',
  'quotation',
  'governance',
] as const

/** Global CRM registers maintained outside CRM_MASTERS_CATALOG */
const CRM_GLOBAL_MASTERS: CrmMasterCatalogItem[] = [
  USER_MASTER_CATALOG,
  PRODUCT_INTEREST_MASTER_CATALOG,
]

/** Slugs hosted under /masters/* instead of /crm/masters/* */
const MASTER_DATA_CRM_PATHS: Record<string, string> = {
  companies: '/masters/companies',
  contacts: '/masters/contacts',
  territories: '/masters/territories',
  industries: '/masters/industries',
  designations: '/masters/designations',
  departments: '/masters/departments',
  'payment-terms': '/masters/payment-terms',
  'product-interests': '/masters/product-interests',
  users: '/masters/users',
  owners: '/masters/users',
}

export function crmMasterHubPath(slug: string): string {
  if (MASTER_DATA_CRM_PATHS[slug]) return MASTER_DATA_CRM_PATHS[slug]
  if (MASTER_DATA_CRM_SLUGS.has(slug)) return `/masters/${slug}`
  return `/crm/masters/${slug}`
}

function catalogToLink(
  catalog: CrmMasterCatalogItem,
  subsection: string,
  status: MasterSetupLink['status'] = 'implemented',
): MasterSetupLink {
  return {
    label: catalog.title,
    path: crmMasterHubPath(catalog.slug),
    description: catalog.description,
    countKey: `crm-${catalog.kind}`,
    groupId: 'crm',
    status,
    subsection,
    slug: catalog.slug,
  }
}

function linkedToLink(
  linked: (typeof CRM_LINKED_MASTERS)[number],
  subsection: string,
): MasterSetupLink {
  return {
    label: linked.title,
    path: crmMasterHubPath(linked.slug),
    description: linked.description,
    countKey: `crm-${linked.slug}`,
    groupId: 'crm',
    status: 'linked',
    subsection,
    slug: linked.slug,
  }
}

/** Every master register consumed by CRM — flat list for /masters hub */
export function buildCrmMasterSetupLinks(): MasterSetupLink[] {
  const links: MasterSetupLink[] = []
  const seen = new Set<string>()

  function push(link: MasterSetupLink) {
    const key = link.slug ?? link.path
    if (seen.has(key)) return
    seen.add(key)
    links.push(link)
  }

  for (const group of CRM_MASTER_HUB_GROUP_ORDER) {
    const subsection = CRM_MASTER_HUB_GROUP_LABELS[group]

    if (group === 'company') {
      for (const global of CRM_GLOBAL_MASTERS.filter((m) => m.group === group)) {
        push(catalogToLink(global, subsection))
      }
    }

    for (const linked of CRM_LINKED_MASTERS.filter((m) => m.group === group)) {
      push(linkedToLink(linked, subsection))
    }

    for (const catalog of CRM_MASTERS_CATALOG.filter((m) => m.group === group)) {
      push(catalogToLink(catalog, subsection))
    }
  }

  return links
}

export function crmMasterCountKey(slug: string): string {
  return `crm-${slug}`
}

export const CRM_MASTERS_SECTION = {
  id: 'crm' as const,
  title: 'CRM Masters',
  description: 'All reference registers used across leads, opportunities, quotations, and sales orders',
  icon: Handshake,
  accent: 'green' as const,
}

/** Icon slug map — shared with hub cards */
export const CRM_MASTER_ICON_SLUGS = [
  'companies',
  'contacts',
  'users',
  'product-interests',
  'lead-sources',
  'industries',
  'designations',
  'departments',
  'territories',
  'lead-stages',
  'lead-priorities',
  'lead-reasons',
  'opportunity-stages',
  'opportunity-priorities',
  'activity-types',
  'lost-reasons',
  'quotation-templates',
  'commercial-terms',
  'payment-terms',
  'delivery-terms',
  'warranty-terms',
  'approval-rules',
  'document-types',
] as const
