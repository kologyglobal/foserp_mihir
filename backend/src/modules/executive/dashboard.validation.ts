import { z } from 'zod'
import { WIDGET_VISUALIZATIONS } from './widget-registry.js'

const visualizationSchema = z.enum(WIDGET_VISUALIZATIONS)

/** FE uses x/y/w/h + configuration/filters; DB uses positionX/width/height + *Json. Prefer FE aliases when present. */
export const widgetLayoutSchema = z
  .object({
    id: z.string().uuid().optional(),
    widgetKey: z.string().trim().min(1).max(100),
    positionX: z.number().int().min(0).max(48).optional(),
    positionY: z.number().int().min(0).max(200).optional(),
    width: z.number().int().min(1).max(24).optional(),
    height: z.number().int().min(1).max(24).optional(),
    x: z.number().int().min(0).max(48).optional(),
    y: z.number().int().min(0).max(200).optional(),
    w: z.number().int().min(1).max(24).optional(),
    h: z.number().int().min(1).max(24).optional(),
    visualization: visualizationSchema.optional().nullable(),
    configurationJson: z.unknown().optional().nullable(),
    filterJson: z.unknown().optional().nullable(),
    configuration: z.unknown().optional().nullable(),
    filters: z.unknown().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if ((v.x ?? v.positionX) === undefined) {
      ctx.addIssue({ code: 'custom', message: 'positionX or x is required', path: ['positionX'] })
    }
    if ((v.y ?? v.positionY) === undefined) {
      ctx.addIssue({ code: 'custom', message: 'positionY or y is required', path: ['positionY'] })
    }
    if ((v.w ?? v.width) === undefined) {
      ctx.addIssue({ code: 'custom', message: 'width or w is required', path: ['width'] })
    }
    if ((v.h ?? v.height) === undefined) {
      ctx.addIssue({ code: 'custom', message: 'height or h is required', path: ['height'] })
    }
  })
  .transform((v) => ({
    widgetKey: v.widgetKey,
    positionX: (v.x ?? v.positionX) as number,
    positionY: (v.y ?? v.positionY) as number,
    width: (v.w ?? v.width) as number,
    height: (v.h ?? v.height) as number,
    visualization: v.visualization ?? null,
    configurationJson: (v.configurationJson ?? v.configuration ?? null) as unknown,
    filterJson: (v.filterJson ?? v.filters ?? null) as unknown,
  }))

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  templateKey: z.string().trim().max(64).optional().nullable(),
  widgets: z.array(widgetLayoutSchema).max(100).optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export const updateDashboardSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    isShared: z.boolean().optional(),
    widgets: z.array(widgetLayoutSchema).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })

export const widgetQuerySchema = z.object({
  widgetKey: z.string().trim().min(1).max(100),
  visualization: visualizationSchema.optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  /** Opaque global filter bag from FE — accepted without strict shape validation. */
  globalFilters: z.record(z.string(), z.unknown()).optional(),
})

export const batchWidgetQuerySchema = z
  .object({
    queries: z.array(widgetQuerySchema).min(1).max(50).optional(),
    widgetKey: z.string().trim().min(1).max(100).optional(),
    visualization: visualizationSchema.optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    globalFilters: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.queries?.length || v.widgetKey), {
    message: 'Provide widgetKey or queries[]',
  })

export type CreateDashboardBody = z.infer<typeof createDashboardSchema>
export type UpdateDashboardBody = z.infer<typeof updateDashboardSchema>
export type WidgetQueryBody = z.infer<typeof widgetQuerySchema>
export type BatchWidgetQueryBody = z.infer<typeof batchWidgetQuerySchema>
