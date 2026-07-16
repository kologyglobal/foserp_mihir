import { useLocation, useParams } from 'react-router-dom'
import { getCrmMasterCatalog } from '../config/crmMastersCatalog'
import { getGlobalMasterCatalog } from '../config/globalMastersCatalog'
import { MASTER_DATA_CRM_SLUGS } from '../config/masterModuleStructure'
import type { CrmMasterCatalogItem, CrmMasterKind } from '../types/crmMasters'
import { slugToKind } from './crmMasterUtils'

export interface MasterRegisterScope {
  slug: string
  kind: CrmMasterKind
  catalog: CrmMasterCatalogItem
  basePath: string
  badge: string
  hubLabel: string
  hubPath: string
}

export function resolveMasterRegisterScope(
  routeSlug?: string | null,
  pathname = '',
): MasterRegisterScope | null {
  if (!routeSlug) return null

  const globalCatalog = getGlobalMasterCatalog(routeSlug)
  if (globalCatalog) {
    return {
      slug: routeSlug,
      kind: globalCatalog.kind,
      catalog: globalCatalog,
      basePath: `/masters/${routeSlug}`,
      badge: 'Master Data',
      hubLabel: 'Master Data',
      hubPath: '/masters',
    }
  }

  const catalog = getCrmMasterCatalog(routeSlug)
  const kind = slugToKind(routeSlug)
  if (!catalog || !kind) return null

  const underMasterData =
    pathname.startsWith('/masters/') || MASTER_DATA_CRM_SLUGS.has(routeSlug)

  return {
    slug: routeSlug,
    kind,
    catalog,
    basePath: underMasterData ? `/masters/${routeSlug}` : `/crm/masters/${routeSlug}`,
    badge: underMasterData ? 'Master Data' : 'CRM Master',
    hubLabel: underMasterData ? 'Master Data' : 'CRM Masters',
    hubPath: underMasterData ? '/masters' : '/crm/masters',
  }
}

export function useMasterRegisterScope(fixedSlug?: string): MasterRegisterScope | null {
  const { kind: paramSlug } = useParams()
  const { pathname } = useLocation()
  return resolveMasterRegisterScope(fixedSlug ?? paramSlug, pathname)
}

export function getMasterRegisterCatalog(slug: string): CrmMasterCatalogItem | undefined {
  return getGlobalMasterCatalog(slug) ?? getCrmMasterCatalog(slug)
}

export function masterRegisterEntryPath(kind: CrmMasterKind, id: string): string {
  if (kind === 'owners') return `/masters/users/${id}`
  if (kind === 'product-interests') return `/masters/product-interests/${id}`
  if (MASTER_DATA_CRM_SLUGS.has(kind)) return `/masters/${kind}/${id}`
  return `/crm/masters/${kind}/${id}`
}

export function masterRegisterListPath(kind: CrmMasterKind): string {
  if (kind === 'owners') return '/masters/users'
  if (kind === 'product-interests') return '/masters/product-interests'
  if (MASTER_DATA_CRM_SLUGS.has(kind)) return `/masters/${kind}`
  return `/crm/masters/${kind}`
}
