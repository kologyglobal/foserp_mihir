import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const ISSUE_TYPE_VALUES = [
  'MATERIAL_SHORTAGE',
  'MACHINE_BREAKDOWN',
  'TOOL_UNAVAILABLE',
  'POWER_FAILURE',
  'QUALITY_HOLD',
  'OPERATOR_UNAVAILABLE',
  'DRAWING_ISSUE',
  'SPECIFICATION_ISSUE',
  'MAINTENANCE_REQUIRED',
  'VENDOR_DELAY',
  'SAFETY_CONCERN',
  'OTHER',
] as const

export const ISSUE_STATUS_VALUES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const
export const ISSUE_SEVERITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export const reportIssueSchema = z.object({
  productionOrderId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  reportedByEmployeeId: z.string().trim().max(64).optional(),
  issueType: z.enum(ISSUE_TYPE_VALUES),
  severity: z.enum(ISSUE_SEVERITY_VALUES).default('MEDIUM'),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  expectedImpactMinutes: z.coerce.number().int().min(0).optional(),
  productionBlocked: z.boolean().default(false),
  stageWideBlock: z.boolean().default(false),
  startDowntime: z.boolean().default(true),
  attachmentReference: z.string().trim().max(500).optional(),
})

export const acknowledgeIssueSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const resolveIssueSchema = z.object({
  resolution: z.string().trim().min(1).max(4000),
  actualDowntimeMinutes: z.coerce.number().int().min(0).optional(),
  endDowntime: z.boolean().default(true),
  resumeAssignment: z.boolean().default(false),
})

export const cancelIssueSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const listIssuesQuerySchema = paginationSchema.extend({
  productionOrderId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  status: z.enum(ISSUE_STATUS_VALUES).optional(),
  issueType: z.enum(ISSUE_TYPE_VALUES).optional(),
  severity: z.enum(ISSUE_SEVERITY_VALUES).optional(),
  productionBlocked: z.coerce.boolean().optional(),
})

export type ReportIssueInput = z.infer<typeof reportIssueSchema>
export type AcknowledgeIssueInput = z.infer<typeof acknowledgeIssueSchema>
export type ResolveIssueInput = z.infer<typeof resolveIssueSchema>
export type CancelIssueInput = z.infer<typeof cancelIssueSchema>
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>
