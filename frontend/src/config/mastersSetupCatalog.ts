import type { LucideIcon } from 'lucide-react'
import {
  ALL_MASTER_DEFINITIONS,
  MASTER_MODULE_GROUPS,
  normalizeMasterGroupId,
  resolveMasterGroupIdFromPath,
  type MasterCatalogGroupId,
  type MasterGroupAccent,
  type MasterModuleGroupId,
} from './masterModuleStructure'
import {
  buildCrmMasterSetupLinks,
  CRM_MASTERS_SECTION,
} from './crmMastersHubCatalog'
import {
  buildPurchaseMasterSetupLinks,
  PURCHASE_MASTERS_SECTION,
} from './purchaseMastersHubCatalog'

export type { MasterCatalogGroupId, MasterGroupAccent, MasterModuleGroupId }
/** @deprecated Use MasterModuleGroupId — kept for existing master form imports */
export type MasterModuleGroupIdLegacy = MasterCatalogGroupId

export interface MasterSetupLink {
  label: string
  path: string
  description?: string
  countKey?: string
  groupId: MasterCatalogGroupId
  status?: 'implemented' | 'placeholder' | 'linked'
  /** Optional sub-heading within a hub category (e.g. CRM pipeline group) */
  subsection?: string
  /** Register slug for icons and deduplication */
  slug?: string
}

export interface MasterSetupGroup {
  id: MasterCatalogGroupId
  title: string
  description: string
  icon: LucideIcon
  accent: MasterGroupAccent
  links: MasterSetupLink[]
}

function toLink(def: (typeof ALL_MASTER_DEFINITIONS)[number]): MasterSetupLink {
  return {
    label: def.label,
    path: def.path,
    description: def.description,
    countKey: def.countKey,
    groupId: def.groupId,
    status: def.status,
  }
}

export const MASTERS_SETUP_GROUPS: MasterSetupGroup[] = [
  ...MASTER_MODULE_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    icon: group.icon,
    accent: group.accent,
    links: group.masters.map(toLink),
  })),
  {
    id: CRM_MASTERS_SECTION.id,
    title: CRM_MASTERS_SECTION.title,
    description: CRM_MASTERS_SECTION.description,
    icon: CRM_MASTERS_SECTION.icon,
    accent: CRM_MASTERS_SECTION.accent,
    links: buildCrmMasterSetupLinks(),
  },
  {
    id: PURCHASE_MASTERS_SECTION.id,
    title: PURCHASE_MASTERS_SECTION.title,
    description: PURCHASE_MASTERS_SECTION.description,
    icon: PURCHASE_MASTERS_SECTION.icon,
    accent: PURCHASE_MASTERS_SECTION.accent,
    links: buildPurchaseMasterSetupLinks(),
  },
]

function dedupeLinksByPath(links: MasterSetupLink[]): MasterSetupLink[] {
  const seen = new Set<string>()
  const out: MasterSetupLink[] = []
  for (const link of links) {
    if (seen.has(link.path)) continue
    seen.add(link.path)
    out.push(link)
  }
  return out
}

export const ALL_MASTER_SETUP_LINKS: MasterSetupLink[] = dedupeLinksByPath(
  MASTERS_SETUP_GROUPS.flatMap((g) => g.links),
)

export function getMasterGroupById(id: MasterCatalogGroupId): MasterSetupGroup | undefined {
  return MASTERS_SETUP_GROUPS.find((g) => g.id === id)
    ?? MASTERS_SETUP_GROUPS.find((g) => g.id === normalizeMasterGroupId(id))
}

export { resolveMasterGroupIdFromPath }

export function resolveMasterGroupFromPath(pathname: string): MasterSetupGroup | undefined {
  const id = resolveMasterGroupIdFromPath(pathname)
  return id ? getMasterGroupById(id) : undefined
}
