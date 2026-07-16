import {
  CrmMasterDetailPage,
  CrmMasterFormPage,
  CrmMasterListPage,
} from '../crm/masters/CrmMasterPages'

/** Global User Management — CRM owner master relocated from CRM Masters. */
export function UserMasterListPage() {
  return <CrmMasterListPage fixedSlug="users" />
}

export function UserMasterFormPage() {
  return <CrmMasterFormPage fixedSlug="users" />
}

export function UserMasterDetailPage() {
  return <CrmMasterDetailPage fixedSlug="users" />
}
