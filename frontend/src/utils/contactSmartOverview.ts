import type {
  CrmSmartChip,
  CrmSmartKeyDetail,
  CrmSmartNextAction,
  CrmSmartSignal,
} from '../components/crm/CrmSmartOverviewPanel'

export interface ContactSmartOverviewInput {
  name: string
  customerId: string | null
  customerName: string
  designation: string
  department: string
  phone: string
  email: string
  isPrimary: boolean
  isActive: boolean
  attachmentCount?: number
  lastSavedLabel?: string
}

export function computeContactCompleteness(input: ContactSmartOverviewInput): number {
  const checks = [
    Boolean(input.name.trim()),
    Boolean(input.customerId),
    Boolean(input.phone.trim() || input.email.trim()),
    Boolean(input.designation.trim() || input.department.trim()),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function buildContactSmartSignals(input: ContactSmartOverviewInput): CrmSmartSignal[] {
  const missing: CrmSmartSignal[] = []
  const ok: CrmSmartSignal[] = []

  if (!input.name.trim()) missing.push({ id: 'name', label: 'Contact name missing', tone: 'warn' })
  else ok.push({ id: 'name', label: 'Name captured', tone: 'ok' })

  if (!input.customerId) missing.push({ id: 'company', label: 'Company not linked', tone: 'warn' })
  else ok.push({ id: 'company', label: 'Company linked', tone: 'ok' })

  if (!input.phone.trim() && !input.email.trim()) {
    missing.push({ id: 'reach', label: 'No phone or email', tone: 'warn' })
  } else {
    ok.push({ id: 'reach', label: 'Reachable contact', tone: 'ok' })
  }

  if (!input.designation.trim() && !input.department.trim()) {
    missing.push({ id: 'role', label: 'Role / department blank', tone: 'warn' })
  } else {
    ok.push({ id: 'role', label: 'Role captured', tone: 'ok' })
  }

  return [...missing, ...ok].slice(0, 3)
}

export function resolveContactNextBestAction(input: ContactSmartOverviewInput): CrmSmartNextAction {
  if (!input.name.trim()) {
    return {
      id: 'enter_name',
      title: 'Enter Contact Name',
      description: 'Start with the person’s full name so this contact can be found later.',
      ctaLabel: 'Enter Name',
      focusField: 'name',
      sectionId: 'quick',
    }
  }
  if (!input.customerId) {
    return {
      id: 'link_company',
      title: 'Link Company',
      description: 'Attach this contact to a company for 360 history and outreach.',
      ctaLabel: 'Link Company',
      focusField: 'customerId',
      sectionId: 'quick',
    }
  }
  if (!input.phone.trim() && !input.email.trim()) {
    return {
      id: 'add_reach',
      title: 'Add Phone or Email',
      description: 'Without a reach channel, follow-ups and activities cannot land.',
      ctaLabel: 'Add Contact Info',
      focusField: 'phone',
      sectionId: 'quick',
    }
  }
  return {
    id: 'save_review',
    title: 'Review & Save',
    description: 'Basics look good. Save the contact or open Company 360 for context.',
    ctaLabel: 'Review Contact',
  }
}

export function buildContactAiInsight(input: ContactSmartOverviewInput): string | null {
  if (!input.name.trim()) return 'Add the contact name first — every other field hangs off that person record.'
  if (!input.customerId) return 'Name is set. Link a company so deals and follow-ups stay account-scoped.'
  if (!input.phone.trim() && !input.email.trim()) {
    return 'Company is linked. Add phone or email so sales can actually reach this person.'
  }
  if (input.isPrimary) return 'Primary contact for the account. Keep phone and email current for CRM outreach.'
  return null
}

export function buildContactKeyDetails(input: ContactSmartOverviewInput): CrmSmartKeyDetail[] {
  return [
    { label: 'Company', value: input.customerName || 'Not linked', muted: !input.customerId },
    { label: 'Designation', value: input.designation.trim() || '—', muted: !input.designation.trim() },
    { label: 'Phone', value: input.phone.trim() || '—', muted: !input.phone.trim() },
    { label: 'Email', value: input.email.trim() || '—', muted: !input.email.trim() },
  ]
}

export function contactOverviewChips(input: ContactSmartOverviewInput): CrmSmartChip[] {
  return [
    { label: input.isActive ? 'Active' : 'Inactive', tone: input.isActive ? 'success' : 'neutral' },
    ...(input.isPrimary ? [{ label: 'Primary', tone: 'info' as const }] : []),
  ]
}

export function contactOverviewTitle(input: ContactSmartOverviewInput): string {
  return input.name.trim() || 'New Contact'
}
