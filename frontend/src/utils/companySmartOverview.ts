import type {
  CrmSmartChip,
  CrmSmartKeyDetail,
  CrmSmartNextAction,
  CrmSmartSignal,
} from '../components/crm/CrmSmartOverviewPanel'
import { formatCurrency } from './formatters/currency'

export interface CompanySmartOverviewInput {
  customerName: string
  customerCode: string
  customerType: string
  city: string
  state: string
  gstin: string
  salesTerritory: string
  creditLimit: number
  creditDays: number
  isActive: boolean
  hasBillingAddress: boolean
  lastSavedLabel?: string
}

/** Deterministic readiness: name · territory · billing · GSTIN (4 equal weights). */
export function computeCompanyCompleteness(input: CompanySmartOverviewInput): number {
  const checks = [
    Boolean(input.customerName.trim()),
    Boolean(input.salesTerritory.trim()),
    input.hasBillingAddress,
    Boolean(input.gstin.trim()),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function buildCompanySmartSignals(input: CompanySmartOverviewInput): CrmSmartSignal[] {
  const missing: CrmSmartSignal[] = []

  if (!input.customerName.trim()) missing.push({ id: 'name', label: 'Company name missing', tone: 'warn' })
  if (!input.hasBillingAddress || !input.city.trim() || !input.state.trim()) {
    missing.push({ id: 'address', label: 'Billing address incomplete', tone: 'warn' })
  }
  if (!input.gstin.trim()) missing.push({ id: 'gstin', label: 'GSTIN pending', tone: 'warn' })
  if (!input.salesTerritory.trim()) missing.push({ id: 'territory', label: 'Territory not set', tone: 'warn' })

  return missing.slice(0, 3)
}

export function resolveCompanyNextBestAction(input: CompanySmartOverviewInput): CrmSmartNextAction {
  if (!input.customerName.trim()) {
    return {
      id: 'enter_name',
      title: 'Enter Company Name',
      description: 'Required before this company can be used in CRM and transactions.',
      ctaLabel: 'Enter Company Name',
      focusField: 'customerName',
      sectionId: 'quick',
    }
  }
  if (!input.hasBillingAddress || !input.city.trim() || !input.state.trim()) {
    return {
      id: 'complete_address',
      title: 'Complete Billing Address',
      description: 'City, state, and address are needed for tax and logistics.',
      ctaLabel: 'Complete Billing Address',
      focusField: 'addressLine1',
      sectionId: 'billing',
    }
  }
  if (!input.gstin.trim()) {
    return {
      id: 'add_gstin',
      title: 'Add GSTIN',
      description: 'Capture GSTIN for compliant quotations and invoices.',
      ctaLabel: 'Add GSTIN',
      focusField: 'gstin',
      sectionId: 'tax',
    }
  }
  if (!input.salesTerritory.trim()) {
    return {
      id: 'set_territory',
      title: 'Set Territory',
      description: 'Assign a sales territory for ownership and reporting.',
      ctaLabel: 'Set Territory',
      focusField: 'salesTerritory',
      sectionId: 'quick',
    }
  }
  return {
    id: 'review',
    title: 'Ready to Save',
    description: 'Core company profile looks complete.',
    ctaLabel: 'Review Company',
  }
}

export function buildCompanyAiInsight(input: CompanySmartOverviewInput): string | null {
  // Lean Smart Context: only when additive beyond NBA / warnings
  if (!input.customerName.trim()) return null
  if (!input.hasBillingAddress || !input.gstin.trim()) return null
  if (input.creditLimit <= 0) {
    return 'Profile is usable. Set a credit limit when commercial terms are known.'
  }
  return null
}

export function buildCompanyKeyDetails(input: CompanySmartOverviewInput): CrmSmartKeyDetail[] {
  const parts = [input.city.trim(), input.state.trim()].filter(Boolean)
  const location = parts.length > 0 ? parts.join(', ') : '—'
  return [
    { label: 'Code', value: input.customerCode.trim() || '—', muted: !input.customerCode.trim() },
    { label: 'Type', value: input.customerType || '—' },
    { label: 'Location', value: location, muted: location === '—' },
    {
      label: 'Credit',
      value: input.creditLimit > 0
        ? `${formatCurrency(input.creditLimit)} · ${input.creditDays}d`
        : `${input.creditDays} days`,
      muted: input.creditLimit <= 0,
    },
  ]
}

export function companyOverviewChips(input: CompanySmartOverviewInput): CrmSmartChip[] {
  return [
    { label: input.isActive ? 'Active' : 'Inactive', tone: input.isActive ? 'success' : 'neutral' },
    { label: input.customerType || 'Company', tone: 'info' },
  ]
}

export function companyOverviewTitle(input: CompanySmartOverviewInput): string {
  return input.customerName.trim() || 'New Company'
}

export function companyContextLine(input: CompanySmartOverviewInput): string {
  const status = input.isActive ? 'Active' : 'Inactive'
  const type = input.customerType
    ? input.customerType.charAt(0).toUpperCase() + input.customerType.slice(1)
    : 'Corporate'
  const territory = input.salesTerritory.trim() || '—'
  return `${status} · ${type} · ${territory}`
}
