/** Manufacturing Phase 6A1 — Production Planning label/tone maps. */
import type { DynamicsStatusTone } from '@/modules/manufacturing/ui'
import type {
  ConsolidationMode,
  DemandSourceType,
  ExceptionSeverity,
  ProductionPlanStatus,
  SuggestionStatus,
} from '../types'

export const PLAN_STATUS_LABELS: Record<ProductionPlanStatus, string> = {
  DRAFT: 'Draft',
  CALCULATING: 'Calculating',
  CALCULATED: 'Calculated',
  REVIEWED: 'Reviewed',
  CANCELLED: 'Cancelled',
  CALCULATION_FAILED: 'Calculation Failed',
}

const PLAN_STATUS_TONE: Record<ProductionPlanStatus, DynamicsStatusTone> = {
  DRAFT: 'neutral',
  CALCULATING: 'live',
  CALCULATED: 'success',
  REVIEWED: 'info',
  CANCELLED: 'critical',
  CALCULATION_FAILED: 'critical',
}

export function planStatusMeta(status: ProductionPlanStatus): { label: string; tone: DynamicsStatusTone } {
  return { label: PLAN_STATUS_LABELS[status] ?? status, tone: PLAN_STATUS_TONE[status] ?? 'neutral' }
}

export const CONSOLIDATION_MODE_LABELS: Record<ConsolidationMode, string> = {
  BY_ITEM: 'By item',
  BY_ITEM_AND_DATE: 'By item & date',
  BY_SALES_ORDER: 'By sales order',
}

export const DEMAND_SOURCE_TYPE_LABELS: Record<DemandSourceType, string> = {
  SALES_ORDER: 'Sales Order',
  FORECAST: 'Forecast',
  REORDER_POINT: 'Reorder Point',
  MANUAL: 'Manual',
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

const SUGGESTION_STATUS_TONE: Record<SuggestionStatus, DynamicsStatusTone> = {
  PENDING: 'pending',
  ACCEPTED: 'success',
  REJECTED: 'critical',
}

export function suggestionStatusMeta(status: SuggestionStatus): { label: string; tone: DynamicsStatusTone } {
  return { label: SUGGESTION_STATUS_LABELS[status] ?? status, tone: SUGGESTION_STATUS_TONE[status] ?? 'neutral' }
}

export const EXCEPTION_SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  INFO: 'Info',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
}

const EXCEPTION_SEVERITY_TONE: Record<ExceptionSeverity, DynamicsStatusTone> = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
}

export function exceptionSeverityMeta(severity: ExceptionSeverity): { label: string; tone: DynamicsStatusTone } {
  return { label: EXCEPTION_SEVERITY_LABELS[severity] ?? severity, tone: EXCEPTION_SEVERITY_TONE[severity] ?? 'neutral' }
}

/** Which plan statuses can still be edited / cancelled before work order suggestions are acted on. */
export function isPlanEditable(status: ProductionPlanStatus): boolean {
  return status === 'DRAFT'
}

export function isPlanCancellable(status: ProductionPlanStatus): boolean {
  return status === 'DRAFT' || status === 'CALCULATED' || status === 'CALCULATION_FAILED'
}
