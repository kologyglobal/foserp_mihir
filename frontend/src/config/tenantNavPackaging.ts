import type { NavCategory, NavItem } from './navigation'
import { moduleCategories } from './navigation'
import { useTenantModulesStore } from '../store/tenantModulesStore'
import { useTenantProfileStore } from '../store/tenantProfileStore'

const SERVICES_HIDDEN_SALES_PATHS = new Set([
  '/sales/invoices',
  '/sales/payment-allocation',
  '/sales/order-status',
])

const SERVICES_EXTRA_SALES_ITEMS: NavItem[] = [
  {
    label: 'Sales Invoices',
    path: '/accounting/money-in/invoices',
    icon: moduleCategories.find((c) => c.id === 'sales')!.items.find((i) => i.path === '/sales/invoices')!.icon,
  },
  {
    label: 'Receipts',
    path: '/accounting/money-in/receipts',
    icon: moduleCategories.find((c) => c.id === 'sales')!.items.find((i) => i.path === '/sales/payment-allocation')!.icon,
  },
  {
    label: 'Outstanding',
    path: '/accounting/money-in/outstanding',
    icon: moduleCategories.find((c) => c.id === 'sales')!.items.find((i) => i.path === '/sales/order-status')!.icon,
  },
]

const SERVICES_HIDDEN_CRM_PATHS = new Set(['/crm/integrations/indiamart/dashboard'])

const SERVICES_HIDDEN_ACCOUNTING_PATHS = new Set(['/accounting/manufacturing'])

/**
 * Filter module nav for current tenant packaging (module flags + SERVICES business type).
 * Does not mutate the canonical moduleCategories array.
 */
export function getPackagedModuleCategories(): NavCategory[] {
  const isServices = useTenantProfileStore.getState().isServices()
  const isModuleEnabled = useTenantModulesStore.getState().isModuleEnabled

  return moduleCategories
    .filter((cat) => {
      if (cat.id === 'executive' || cat.id === 'admin' || cat.id === 'platform') return true
      return isModuleEnabled(cat.id)
    })
    .map((cat) => {
      let items = cat.items
      if (isServices && cat.id === 'crm') {
        items = items.filter((i) => !SERVICES_HIDDEN_CRM_PATHS.has(i.path))
      }
      if (isServices && cat.id === 'sales') {
        items = [
          ...items.filter((i) => !SERVICES_HIDDEN_SALES_PATHS.has(i.path)),
          ...SERVICES_EXTRA_SALES_ITEMS,
        ]
      }
      if (isServices && cat.id === 'accounting') {
        items = items.filter((i) => !SERVICES_HIDDEN_ACCOUNTING_PATHS.has(i.path))
      }
      if (isServices && cat.id === 'masters') {
        // Prefer Items (Services); Product master is manufacturing-shaped — hide product paths when present
        items = items.filter((i) => !/\/masters\/products\b/.test(i.path) && !/\/products\b/.test(i.path))
      }
      return { ...cat, items }
    })
}
