import type { QcInspectionCategory } from './quality'

export type QcParameterType = 'boolean' | 'numeric' | 'text' | 'dropdown' | 'photo_required'
export type QcParameterSeverity = 'minor' | 'major' | 'critical'
export type QcPassFailRule = 'boolean_true' | 'boolean_false' | 'numeric_tolerance' | 'manual'
export type InspectionPlanStatus = 'draft' | 'active' | 'inactive'

export interface QcParameterMaster {
  id: string
  parameterCode: string
  parameterName: string
  parameterType: QcParameterType
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  mandatory: boolean
  severity: QcParameterSeverity
  passFailRule: QcPassFailRule
  dropdownOptions: string[] | null
  active?: boolean
}

export interface InspectionPlanLine {
  id: string
  planId: string
  parameterId: string
  sortOrder: number
  mandatoryOverride: boolean | null
  minValueOverride: number | null
  maxValueOverride: number | null
  targetValueOverride: number | null
  severityOverride?: QcParameterSeverity | null
  photoRequiredOverride?: boolean | null
  remarksRequired?: boolean
}

export interface DynamicInspectionPlan {
  id: string
  planCode: string
  planName: string
  category: QcInspectionCategory
  productId: string | null
  itemId: string | null
  itemCategoryId: string | null
  operationName: string | null
  workCenterId: string | null
  effectiveFrom: string
  effectiveTo?: string | null
  revision?: string
  status: InspectionPlanStatus
  lines: InspectionPlanLine[]
}

export interface QcParameterSnapshot {
  parameterId: string
  parameterCode: string
  parameterName: string
  parameterType: QcParameterType
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  mandatory: boolean
  severity: QcParameterSeverity
  passFailRule: QcPassFailRule
  dropdownOptions: string[] | null
  sortOrder: number
}

export interface QcParameterResult {
  parameterId: string
  parameterCode: string
  parameterName: string
  parameterType: QcParameterType
  mandatory: boolean
  severity: QcParameterSeverity
  passFailRule: QcPassFailRule
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  dropdownOptions: string[] | null
  actualValue: string | number | boolean | null
  passed: boolean | null
  remarks: string
  attachmentRef: string | null
  inspector: string | null
  recordedAt: string | null
}

export type QcAutoDecision = 'pass' | 'rework' | 'reject'

export interface QcSubmissionValidation {
  ok: boolean
  errors: string[]
  autoDecision: QcAutoDecision | null
  failedParameters: QcParameterResult[]
}
