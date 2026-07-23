import type { SalesInvoice, SalesInvoiceLine, SalesInvoiceSourceLink } from '@prisma/client'

/** Sales invoice row with line items (and optional source links). */
export type SalesInvoiceWithLines = SalesInvoice & {
  lines: SalesInvoiceLine[]
  sourceLinks?: SalesInvoiceSourceLink[]
}
