import type { DashboardQuickView } from '../../types/dashboardInteraction'

export type LiveAlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type LiveAlertCategory =
  | 'shortage'
  | 'qc_hold'
  | 'approval'
  | 'delay'
  | 'dispatch'
  | 'payment'
  | 'eco'
  | 'document'
  | 'general'

export interface LiveAlert {
  id: string
  severity: LiveAlertSeverity
  category: LiveAlertCategory
  message: string
  documentRef?: string
  href?: string
  actionLabel?: string
  quickView?: DashboardQuickView
}

export interface NextBestAction {
  id: string
  label: string
  description?: string
  href?: string
  onClick?: () => void
  priority?: 'primary' | 'secondary'
}

export type DocumentHealth = 'healthy' | 'at_risk' | 'blocked' | 'critical'

export interface LiveActivityEvent {
  id: string
  icon?: 'material' | 'qc' | 'rework' | 'approval' | 'qr' | 'dispatch' | 'payment' | 'general'
  action: string
  user?: string
  timestamp: string
  href?: string
  documentRef?: string
  simulated?: boolean
  quickView?: DashboardQuickView
}
