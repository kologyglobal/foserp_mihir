import type { LucideIcon } from 'lucide-react'

export type StatusTone = 'draft' | 'open' | 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'in_progress' | 'overdue' | 'blocked' | 'closed' | 'info' | 'success' | 'warning' | 'danger'

export interface StatusDefinition {
  label: string
  tone: StatusTone
}

/** Canonical status badge mapping — no custom badge colors in pages */
export const STATUS_MAP: Record<string, StatusDefinition> = {
  draft: { label: 'Draft', tone: 'draft' },
  open: { label: 'Open', tone: 'open' },
  pending: { label: 'Pending', tone: 'pending' },
  pending_approval: { label: 'Pending Approval', tone: 'pending' },
  submitted: { label: 'Submitted', tone: 'pending' },
  approved: { label: 'Approved', tone: 'approved' },
  released: { label: 'Released', tone: 'approved' },
  rejected: { label: 'Rejected', tone: 'rejected' },
  completed: { label: 'Completed', tone: 'completed' },
  closed: { label: 'Closed', tone: 'closed' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
  in_progress: { label: 'In Progress', tone: 'in_progress' },
  overdue: { label: 'Overdue', tone: 'overdue' },
  blocked: { label: 'Blocked', tone: 'blocked' },
  sent: { label: 'Sent', tone: 'info' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'danger' },
}

export function resolveStatus(status: string): StatusDefinition {
  const key = status.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return STATUS_MAP[key] ?? { label: status.replace(/_/g, ' '), tone: 'info' }
}

export interface PageHelpContent {
  purpose: string
  businessUse?: string
  requiredFields?: string[]
  nextProcess?: string
  tips?: string[]
  bestPractices?: string[]
  shortcuts?: { keys: string; action: string }[]
  relatedPages?: { label: string; path: string }[]
}

export const DEFAULT_HELP: PageHelpContent = {
  purpose: 'Manage ERP records using the standard workspace layout.',
  nextProcess: 'Review list filters, open a record, or create a new entry.',
}

export type { LucideIcon }
