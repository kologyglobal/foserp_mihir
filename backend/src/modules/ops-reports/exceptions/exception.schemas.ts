import { z } from 'zod'

export const listExceptionsQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  severity: z.string().trim().min(1).optional(),
  resolutionStatus: z.string().trim().min(1).optional(),
})

export const exceptionKeyParamSchema = z.object({
  exceptionKey: z.string().trim().min(1).max(250),
})

export const assignExceptionSchema = z.object({
  assignedTo: z.string().trim().min(1).max(191),
})

export const resolveExceptionSchema = z.object({
  resolutionNote: z.string().trim().max(1000).optional(),
  dismiss: z.boolean().default(false),
})

export type ListExceptionsQueryInput = z.infer<typeof listExceptionsQuerySchema>
export type AssignExceptionInput = z.infer<typeof assignExceptionSchema>
export type ResolveExceptionInput = z.infer<typeof resolveExceptionSchema>
