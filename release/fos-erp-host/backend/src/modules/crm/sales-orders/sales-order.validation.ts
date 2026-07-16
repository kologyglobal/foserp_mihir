import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const SALES_ORDER_STATUSES = ['open', 'confirmed', 'in_production', 'ready_dispatch', 'dispatched', 'invoiced', 'closed'] as const

export const listSalesOrdersQuerySchema = paginationSchema.extend({
  customerId: z.string().uuid().optional(),
  quotationId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  status: z.enum(SALES_ORDER_STATUSES).optional(),
  search: z.string().trim().optional(),
})

export const convertQuotationToSalesOrderSchema = z.object({
  documentId: z.string().uuid().optional(),
  customerPoNumber: z.string().trim().min(1).optional(),
  customerPoDate: z.string().datetime().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  deliveryLocation: z.string().trim().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  internalRemarks: z.string().trim().optional().nullable(),
})

export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersQuerySchema>
export type ConvertQuotationToSalesOrderInput = z.infer<typeof convertQuotationToSalesOrderSchema>
