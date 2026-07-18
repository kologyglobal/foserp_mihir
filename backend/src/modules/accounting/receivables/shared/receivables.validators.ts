import { NotFoundError, ValidationError } from '../../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'

export async function assertSalesInvoiceTenantOwnership(
  tenantId: string,
  salesInvoiceId: string,
  findById: (tenantId: string, id: string) => Promise<{ id: string; legalEntityId: string } | null>,
): Promise<{ id: string; legalEntityId: string }> {
  const invoice = await findById(tenantId, salesInvoiceId)
  if (!invoice) throw new NotFoundError('Sales invoice not found')
  return invoice
}

export async function assertReceivableOpenItemTenantOwnership(
  tenantId: string,
  openItemId: string,
  findById: (tenantId: string, id: string) => Promise<{ id: string; legalEntityId: string } | null>,
): Promise<{ id: string; legalEntityId: string }> {
  const item = await findById(tenantId, openItemId)
  if (!item) throw new NotFoundError('Receivable open item not found')
  return item
}

export async function assertLegalEntityScope(
  tenantId: string,
  legalEntityId: string,
  resourceLegalEntityId: string,
): Promise<void> {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  if (resourceLegalEntityId !== legalEntityId) {
    throw new ValidationError('Resource does not belong to the specified legal entity')
  }
}
