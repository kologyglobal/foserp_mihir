/**
 * Load + validate a CRM Proforma Invoice as the source document for a Money-In
 * Sales Invoice ("Create Tax Invoice" from Sales → Proforma Invoices).
 * Soft link only — no Prisma FK from sales_invoices to crm_proforma_invoices.
 */
import { prisma } from '../../../../config/database.js'
import {
  ProformaInvoiceCustomerMismatchError,
  ProformaInvoiceNotEligibleError,
  ProformaInvoiceNotFoundError,
} from '../sales-invoices/sales-invoice.errors.js'

export interface ProformaInvoiceSourceLineSnapshot {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  description: string
  hsnCode: string | null
  qty: string
  uom: string
  unitPrice: string
  discountPct: string
  taxPct: string
}

export interface ProformaInvoiceSourceSnapshot {
  id: string
  proformaNo: string
  proformaDate: string
  status: string
  customerId: string
  customerPoNumber: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  quotationId: string | null
  quotationNo: string | null
  placeOfSupply: string | null
  paymentTerms: string | null
  deliveryTerms: string | null
  grandTotal: string
  lines: ProformaInvoiceSourceLineSnapshot[]
}

export interface ProformaInvoiceSourceContext {
  snapshot: ProformaInvoiceSourceSnapshot
  warnings: Array<{ code: string; message: string }>
}

/**
 * Status whitelist mirrors the FE store gate (`ProformaInvoicePages.tsx` /
 * `resolveTaxInvoiceFromProforma`): only an issued proforma may be invoiced.
 */
export async function loadProformaInvoiceSource(
  tenantId: string,
  proformaId: string,
  expectedCustomerId: string,
): Promise<ProformaInvoiceSourceContext> {
  const proforma = await prisma.crmProformaInvoice.findFirst({
    where: { id: proformaId, tenantId, deletedAt: null },
    include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
  })
  if (!proforma) throw new ProformaInvoiceNotFoundError(proformaId)
  if (proforma.status === 'cancelled') {
    throw new ProformaInvoiceNotEligibleError('Cannot create a tax invoice from a cancelled proforma invoice')
  }
  if (proforma.status === 'draft') {
    throw new ProformaInvoiceNotEligibleError('Issue the proforma invoice before creating a tax invoice')
  }
  if (proforma.companyId !== expectedCustomerId) {
    throw new ProformaInvoiceCustomerMismatchError()
  }

  const warnings: Array<{ code: string; message: string }> = []
  const existingCount = await prisma.salesInvoice.count({
    where: {
      tenantId,
      sourceType: 'PROFORMA_INVOICE',
      sourceDocumentId: proformaId,
      status: { not: 'CANCELLED' },
    },
  })
  if (existingCount > 0) {
    warnings.push({
      code: 'PROFORMA_ALREADY_INVOICED',
      message: 'Another sales invoice is already linked to this proforma invoice',
    })
  }

  return {
    snapshot: {
      id: proforma.id,
      proformaNo: proforma.proformaNo,
      proformaDate: proforma.proformaDate.toISOString().slice(0, 10),
      status: proforma.status,
      customerId: proforma.companyId,
      customerPoNumber: proforma.customerPoNumber,
      salesOrderId: proforma.salesOrderId,
      salesOrderNo: proforma.salesOrderNo,
      quotationId: proforma.quotationId,
      quotationNo: proforma.quotationNo,
      placeOfSupply: proforma.placeOfSupply,
      paymentTerms: proforma.paymentTerms,
      deliveryTerms: proforma.deliveryTerms,
      grandTotal: proforma.grandTotal.toString(),
      lines: proforma.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        itemId: l.itemId,
        itemCode: l.itemCode,
        description: l.description,
        hsnCode: l.hsnCode,
        qty: l.qty.toString(),
        uom: l.uom,
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        taxPct: l.taxPct.toString(),
      })),
    },
    warnings,
  }
}
