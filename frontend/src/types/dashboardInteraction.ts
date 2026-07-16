export interface DashboardQuickViewField {
  label: string
  value: string
  href?: string
}

export interface DashboardQuickViewRelated {
  label: string
  value: string
  href: string
}

export interface DashboardQuickView {
  title: string
  subtitle?: string
  badge?: string
  badgeTone?: 'success' | 'warning' | 'critical' | 'neutral'
  fields: DashboardQuickViewField[]
  related?: DashboardQuickViewRelated[]
  primaryAction?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
}

export type DashboardFeedCategory =
  | 'pipeline'
  | 'lead'
  | 'quotation'
  | 'order'
  | 'billing'
  | 'alert'
  | 'activity'

export type DashboardFeedFilter = 'all' | DashboardFeedCategory

export interface DashboardFeedItem {
  id: string
  category: DashboardFeedCategory
  title: string
  subtitle?: string
  timestamp: string
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  icon?: 'material' | 'qc' | 'rework' | 'approval' | 'qr' | 'dispatch' | 'payment' | 'general'
  href?: string
  documentRef?: string
  user?: string
  quickView?: DashboardQuickView
}

export const DASHBOARD_FEED_FILTER_LABELS: Record<DashboardFeedFilter, string> = {
  all: 'All updates',
  pipeline: 'Pipeline',
  lead: 'Leads',
  quotation: 'Quotations',
  order: 'Orders',
  billing: 'Billing',
  alert: 'Alerts',
  activity: 'Activities',
}
