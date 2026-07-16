import {
  getMasterGroupById,
  type MasterCatalogGroupId,
} from '../config/mastersSetupCatalog'
import { normalizeMasterGroupId } from '../config/masterModuleStructure'

export interface MasterBreadcrumb {
  label: string
  to?: string
}

export function buildMasterBreadcrumbs(
  groupId: MasterCatalogGroupId,
  pageTitle: string,
): MasterBreadcrumb[] {
  const group = getMasterGroupById(normalizeMasterGroupId(groupId))
  return [
    { label: 'Master Data', to: '/masters' },
    { label: group?.title ?? 'Masters', to: `/masters#${groupId}` },
    { label: pageTitle },
  ]
}

export function buildMasterFormBreadcrumbs(
  groupId: MasterCatalogGroupId,
  listTitle: string,
  listPath: string,
  formTitle: string,
): MasterBreadcrumb[] {
  const group = getMasterGroupById(normalizeMasterGroupId(groupId))
  return [
    { label: 'Master Data', to: '/masters' },
    { label: group?.title ?? 'Masters', to: `/masters#${groupId}` },
    { label: listTitle, to: listPath },
    { label: formTitle },
  ]
}
