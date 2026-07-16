import { crmChildBreadcrumbs, crmModuleBreadcrumbs } from './crmNavigation'

export function contactListBreadcrumbs() {
  return crmModuleBreadcrumbs('Contacts', '/crm/contacts')
}

export function contactNewBreadcrumbs() {
  return crmChildBreadcrumbs('Contacts', '/crm/contacts', 'New Contact')
}

export function contactEditBreadcrumbs(contactName?: string) {
  return crmChildBreadcrumbs('Contacts', '/crm/contacts', contactName?.trim() || 'Edit Contact')
}

export function contactViewBreadcrumbs(contactName?: string) {
  return crmChildBreadcrumbs('Contacts', '/crm/contacts', contactName?.trim() || 'Contact')
}
