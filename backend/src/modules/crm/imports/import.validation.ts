import { z } from 'zod'

const importRowSchema = z.record(z.string())

export const importPayloadSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
  duplicateMode: z.enum(['skip', 'update', 'error']).default('skip'),
})

export type ImportPayload = z.infer<typeof importPayloadSchema>

export interface ImportRowResult {
  row: number
  ok: boolean
  code?: string
  errors?: string[]
}

export interface ImportSummary {
  imported: number
  updated: number
  skipped: number
  failed: number
  rows: ImportRowResult[]
}
