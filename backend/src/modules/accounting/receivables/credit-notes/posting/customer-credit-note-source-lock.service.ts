import type { Prisma } from '@prisma/client'

export async function lockCustomerCreditNoteSource(
  tx: Prisma.TransactionClient,
  tenantId: string,
  originalInvoiceId: string | null,
) {
  if (!originalInvoiceId) return
  await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${originalInvoiceId} AND tenantId = ${tenantId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM sales_invoice_lines WHERE salesInvoiceId = ${originalInvoiceId} AND tenantId = ${tenantId} FOR UPDATE`
}
