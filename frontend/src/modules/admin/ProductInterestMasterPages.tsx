import {
  CrmMasterDetailPage,
  CrmMasterFormPage,
  CrmMasterListPage,
} from '../crm/masters/CrmMasterPages'

/** Global Product Interest register — relocated from CRM Masters. */
export function ProductInterestMasterListPage() {
  return <CrmMasterListPage fixedSlug="product-interests" />
}

export function ProductInterestMasterFormPage() {
  return <CrmMasterFormPage fixedSlug="product-interests" />
}

export function ProductInterestMasterDetailPage() {
  return <CrmMasterDetailPage fixedSlug="product-interests" />
}
