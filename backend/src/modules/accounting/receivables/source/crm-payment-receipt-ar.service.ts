/**
 * CRM Payment Receipt → Money In CustomerReceipt draft handoff.
 * Never posts GL. Finance reviews and posts in Money In.
 */
import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/prisma.js'
import { createAuditLog, auditFromRequest } from '../../../../services/audit.service.js'
import { NotFoundError, ValidationError, AuthorizationError } from '../../../../utils/errors.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import { createCustomerReceiptDraft } from '../receipts/customer-receipt-draft.service.js'
import type { CreateCustomerReceiptInput } from '../receipts/customer-receipt.schemas.js'
import type { CustomerReceiptPaymentMethod } from '../receipts/customer-receipt.types.js'
import {
  checkCustomerReceiptDuplicates,
  type DuplicateCheckResult,
} from './accounting-receipt-duplicate.service.js'

const ACCOUNTING_CONTROLLED_MSG =
  'This invoice is managed by Accounting Money In. Record and allocate the payment through Money In.'

export function isCrmTaxInvoiceAccountingControlled(inv: {
  salesInvoiceId: string | null
  accountingStatus: string
}): boolean {
  if (inv.salesInvoiceId) return true
  return inv.accountingStatus === 'pending_review' || inv.accountingStatus === 'converted'
}

export function assertCrmTaxInvoiceAllowsCommercialAllocation(inv: {
  invoiceNo: string
  salesInvoiceId: string | null
  accountingStatus: string
}): void {
  if (isCrmTaxInvoiceAccountingControlled(inv)) {
    throw new ValidationError(ACCOUNTING_CONTROLLED_MSG)
  }
}

function mapPaymentMode(mode: string): CustomerReceiptPaymentMethod {
  switch (mode) {
    case 'cash':
      return 'CASH'
    case 'cheque':
      return 'CHEQUE'
    case 'upi':
      return 'UPI'
    case 'bank':
    case 'neft':
    case 'rtgs':
      return 'BANK_TRANSFER'
    default:
      return 'OTHER'
  }
}

function dateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function money(v: Prisma.Decimal | number): string {
  if (typeof v === 'number') return v.toFixed(2)
  return v.toFixed(2)
}

async function resolveDefaultLegalEntityId(tenantId: string, preferred?: string | null): Promise<string> {
  if (preferred) {
    const le = await prisma.legalEntity.findFirst({
      where: { id: preferred, tenantId, isActive: true },
      select: { id: true },
    })
    if (!le) throw new ValidationError('Legal entity not found for tenant')
    return le.id
  }
  const first = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!first) throw new ValidationError('No active legal entity configured for Accounting')
  return first.id
}

export async function getCrmPaymentReceiptAccountingStatus(tenantId: string, receiptId: string) {
  const receipt = await prisma.crmPaymentReceipt.findFirst({
    where: { id: receiptId, tenantId, deletedAt: null },
  })
  if (!receipt) throw new NotFoundError('Payment receipt not found')

  let accountingReceipt: {
    id: string
    status: string
    receiptNumber: string | null
    draftReference: string | null
    postingDate: string | null
    allocatedAmount: string
    unallocatedAmount: string
    sourceType: string
  } | null = null

  if (receipt.accountingReceiptId) {
    const ar = await prisma.customerReceipt.findFirst({
      where: { id: receipt.accountingReceiptId, tenantId },
      select: {
        id: true,
        status: true,
        receiptNumber: true,
        draftReference: true,
        postingDate: true,
        allocatedAmount: true,
        unallocatedAmount: true,
        sourceType: true,
      },
    })
    if (ar) {
      accountingReceipt = {
        id: ar.id,
        status: ar.status,
        receiptNumber: ar.receiptNumber,
        draftReference: ar.draftReference,
        postingDate: ar.postingDate ? dateOnly(ar.postingDate) : null,
        allocatedAmount: money(ar.allocatedAmount),
        unallocatedAmount: money(ar.unallocatedAmount),
        sourceType: ar.sourceType,
      }
    }
  }

  const redirectUrl = receipt.accountingReceiptId
    ? `/accounting/money-in/receipts/${receipt.accountingReceiptId}`
    : null

  return {
    crmPaymentReceiptId: receipt.id,
    receiptNo: receipt.receiptNo,
    commercialOnly: receipt.commercialOnly,
    accountingMigrationStatus: receipt.accountingMigrationStatus,
    accountingMigrationError: receipt.accountingMigrationError,
    accountingMigratedAt: receipt.accountingMigratedAt?.toISOString() ?? null,
    accountingReceiptId: receipt.accountingReceiptId,
    accountingReceipt,
    redirectUrl,
  }
}

export async function checkCrmPaymentReceiptDuplicates(
  tenantId: string,
  receiptId: string,
): Promise<DuplicateCheckResult> {
  const receipt = await prisma.crmPaymentReceipt.findFirst({
    where: { id: receiptId, tenantId, deletedAt: null },
  })
  if (!receipt) throw new NotFoundError('Payment receipt not found')

  return checkCustomerReceiptDuplicates({
    tenantId,
    customerId: receipt.companyId,
    amount: Number(receipt.amount),
    currencyCode: 'INR',
    receiptDate: dateOnly(receipt.receiptDate),
    paymentMethod: mapPaymentMode(receipt.paymentMode),
    transactionReference: receipt.transactionRef,
    crmPaymentReceiptId: receipt.id,
    excludeCustomerReceiptId: receipt.accountingReceiptId,
  })
}

export type CreateAccountingDraftBody = {
  legalEntityId?: string | null
  branchId?: string | null
  bankCashAccountId: string
  customerReceivableAccountId?: string | null
  /** Required when duplicate level is PROBABLE */
  overrideDuplicate?: boolean
  overrideReason?: string | null
}

export async function createAccountingDraftFromCrmPaymentReceipt(
  req: Request,
  tenantId: string,
  receiptId: string,
  body: CreateAccountingDraftBody,
  options?: { isRetry?: boolean },
) {
  const userId = req.context?.userId
  const audit = auditFromRequest(req)

  const receipt = await prisma.crmPaymentReceipt.findFirst({
    where: { id: receiptId, tenantId, deletedAt: null },
  })
  if (!receipt) throw new NotFoundError('Payment receipt not found')

  if (receipt.accountingMigrationStatus === 'NON_ACCOUNTING') {
    throw new ValidationError('Receipt is marked non-accounting and cannot create a Money In draft')
  }
  if (receipt.accountingMigrationStatus === 'REJECTED') {
    throw new ValidationError('Receipt migration was rejected')
  }

  // Idempotent reuse of existing linked draft / posted receipt
  if (receipt.accountingReceiptId) {
    const existing = await prisma.customerReceipt.findFirst({
      where: { id: receipt.accountingReceiptId, tenantId },
    })
    if (existing && existing.status !== 'CANCELLED') {
      await createAuditLog({
        tenantId,
        userId: userId ?? null,
        module: 'crm',
        entity: 'crmPaymentReceipt',
        entityId: receipt.id,
        action: 'CRM_ACCOUNTING_DRAFT_REUSED',
        newValues: {
          customerReceiptId: existing.id,
          status: existing.status,
        },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      })
      return {
        crmPaymentReceiptId: receipt.id,
        customerReceiptId: existing.id,
        status: existing.status,
        reused: true,
        redirectUrl: `/accounting/money-in/receipts/${existing.id}`,
      }
    }
  }

  // Also search by source key
  const bySource = await prisma.customerReceipt.findFirst({
    where: {
      tenantId,
      sourceType: 'CRM_PAYMENT_RECEIPT',
      sourceDocumentId: receipt.id,
      status: { notIn: ['CANCELLED'] },
    },
  })
  if (bySource) {
    await prisma.crmPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        accountingReceiptId: bySource.id,
        accountingMigrationStatus:
          bySource.status === 'POSTED' ? 'MIGRATED' : 'DRAFT_CREATED',
        commercialOnly: false,
        accountingMigrationError: null,
        accountingMigratedAt: bySource.status === 'POSTED' ? new Date() : receipt.accountingMigratedAt,
        accountingMigratedBy: userId ?? receipt.accountingMigratedBy,
        updatedBy: userId ?? undefined,
      },
    })
    return {
      crmPaymentReceiptId: receipt.id,
      customerReceiptId: bySource.id,
      status: bySource.status,
      reused: true,
      redirectUrl: `/accounting/money-in/receipts/${bySource.id}`,
    }
  }

  const amount = Number(receipt.amount)
  if (!(amount > 0)) throw new ValidationError('Receipt amount must be greater than zero')

  await requireActiveCustomerParty(tenantId, receipt.companyId)

  const duplicate = await checkCustomerReceiptDuplicates({
    tenantId,
    customerId: receipt.companyId,
    amount,
    currencyCode: 'INR',
    receiptDate: dateOnly(receipt.receiptDate),
    paymentMethod: mapPaymentMode(receipt.paymentMode),
    transactionReference: receipt.transactionRef,
    crmPaymentReceiptId: receipt.id,
  })

  await createAuditLog({
    tenantId,
    userId: userId ?? null,
    module: 'crm',
    entity: 'crmPaymentReceipt',
    entityId: receipt.id,
    action: 'CRM_ACCOUNTING_DUPLICATE_DETECTED',
    newValues: {
      level: duplicate.level,
      matchCount: duplicate.matches.length,
      matchIds: duplicate.matches.map((m) => m.customerReceiptId),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  if (duplicate.level === 'EXACT') {
    await prisma.crmPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        accountingMigrationStatus: 'DUPLICATE',
        accountingMigrationError: duplicate.message,
        updatedBy: userId ?? undefined,
      },
    })
    throw new ValidationError(duplicate.message ?? 'Exact duplicate found')
  }

  if (duplicate.level === 'PROBABLE') {
    if (!body.overrideDuplicate) {
      await prisma.crmPaymentReceipt.update({
        where: { id: receipt.id },
        data: {
          accountingMigrationStatus: 'DUPLICATE',
          accountingMigrationError: duplicate.message,
          updatedBy: userId ?? undefined,
        },
      })
      throw new ValidationError(
        duplicate.message ??
          'Probable duplicate — resubmit with overrideDuplicate and overrideReason',
      )
    }
    if (!body.overrideReason?.trim()) {
      throw new ValidationError('overrideReason is required when overriding a probable duplicate')
    }
    const perms = req.context?.permissions ?? []
    const canOverride =
      perms.includes('tenant.manage') || perms.includes('finance.ar.crm_receipt_duplicate.override')
    if (!canOverride) {
      throw new AuthorizationError('Missing permission: finance.ar.crm_receipt_duplicate.override')
    }
    await createAuditLog({
      tenantId,
      userId: userId ?? null,
      module: 'crm',
      entity: 'crmPaymentReceipt',
      entityId: receipt.id,
      action: 'CRM_ACCOUNTING_DUPLICATE_OVERRIDE',
      newValues: {
        reason: body.overrideReason.trim(),
        matches: duplicate.matches.map((m) => m.customerReceiptId),
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
  }

  if (!body.bankCashAccountId) {
    throw new ValidationError('bankCashAccountId is required to create a Money In receipt draft')
  }

  const legalEntityId = await resolveDefaultLegalEntityId(tenantId, body.legalEntityId)
  const receiptDate = dateOnly(receipt.receiptDate)
  const paymentMethod = mapPaymentMode(receipt.paymentMode)

  // Suggested allocation targets (informational only — no allocation until post+allocate in Money In)
  const suggestedSalesInvoices = await prisma.salesInvoice.findMany({
    where: {
      tenantId,
      customerId: receipt.companyId,
      status: 'POSTED',
      sourceType: 'CRM_TAX_INVOICE',
    },
    select: {
      id: true,
      invoiceNumber: true,
      sourceDocumentId: true,
      totalAmount: true,
    },
    take: 20,
  })

  const input: CreateCustomerReceiptInput = {
    legalEntityId,
    branchId: body.branchId ?? null,
    customerId: receipt.companyId,
    sourceType: 'CRM_PAYMENT_RECEIPT',
    sourceDocumentId: receipt.id,
    sourceDocumentNumber: receipt.receiptNo,
    receiptDate,
    postingDate: receiptDate,
    valueDate: receiptDate,
    paymentMethod,
    currencyCode: 'INR',
    exchangeRate: '1',
    bankCashAmount: money(receipt.amount),
    bankCashAccountId: body.bankCashAccountId,
    customerReceivableAccountId: body.customerReceivableAccountId ?? null,
    transactionReference: receipt.transactionRef ?? null,
    narration: receipt.remarks
      ? `From CRM receipt ${receipt.receiptNo}: ${receipt.remarks}`
      : `From CRM receipt ${receipt.receiptNo}`,
    notes: [
      options?.isRetry ? 'Retry accounting draft from CRM' : 'Created from CRM payment receipt',
      receipt.proformaNo ? `Proforma: ${receipt.proformaNo} (advance — allocate after SI post)` : null,
      suggestedSalesInvoices.length
        ? `Suggested CRM-linked SI count: ${suggestedSalesInvoices.length}`
        : 'No converted CRM tax invoice SI found — draft as unallocated advance',
    ]
      .filter(Boolean)
      .join('\n'),
  }

  try {
    const detail = await createCustomerReceiptDraft(req, tenantId, input)
    const customerReceiptId = detail.id as string

    await prisma.crmPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        accountingReceiptId: customerReceiptId,
        accountingMigrationStatus: 'DRAFT_CREATED',
        accountingMigrationError: null,
        commercialOnly: false,
        accountingMigratedAt: null,
        accountingMigratedBy: userId ?? null,
        updatedBy: userId ?? undefined,
      },
    })

    await createAuditLog({
      tenantId,
      userId: userId ?? null,
      module: 'crm',
      entity: 'crmPaymentReceipt',
      entityId: receipt.id,
      action: 'CRM_ACCOUNTING_DRAFT_CREATED',
      newValues: {
        customerReceiptId,
        status: 'DRAFT',
        suggestedSalesInvoiceIds: suggestedSalesInvoices.map((s) => s.id),
        duplicateLevel: duplicate.level,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })

    await createAuditLog({
      tenantId,
      userId: userId ?? null,
      module: 'crm',
      entity: 'crmPaymentReceipt',
      entityId: receipt.id,
      action: 'CRM_RECEIPT_LINKED_TO_ACCOUNTING',
      newValues: { customerReceiptId },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })

    return {
      crmPaymentReceiptId: receipt.id,
      customerReceiptId,
      status: 'DRAFT',
      reused: false,
      redirectUrl: `/accounting/money-in/receipts/${customerReceiptId}`,
      duplicate,
      warnings: suggestedSalesInvoices.length
        ? []
        : [
            'No posted Accounting sales invoice found for this customer from CRM tax invoices. Receipt will be an unallocated advance until allocation after SI posting.',
          ],
      suggestedSalesInvoices: suggestedSalesInvoices.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        crmTaxInvoiceId: s.sourceDocumentId,
        totalAmount: money(s.totalAmount),
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create accounting draft'
    await prisma.crmPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        accountingMigrationStatus: 'FAILED',
        accountingMigrationError: message,
        updatedBy: userId ?? undefined,
      },
    })
    await createAuditLog({
      tenantId,
      userId: userId ?? null,
      module: 'crm',
      entity: 'crmPaymentReceipt',
      entityId: receipt.id,
      action: 'CRM_RECEIPT_MIGRATION_FAILED',
      newValues: { error: message },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    throw err
  }
}

export async function markCrmPaymentReceiptNonAccounting(
  req: Request,
  tenantId: string,
  receiptId: string,
  reason?: string | null,
) {
  const userId = req.context?.userId
  const audit = auditFromRequest(req)
  const receipt = await prisma.crmPaymentReceipt.findFirst({
    where: { id: receiptId, tenantId, deletedAt: null },
  })
  if (!receipt) throw new NotFoundError('Payment receipt not found')
  if (receipt.accountingReceiptId) {
    const ar = await prisma.customerReceipt.findFirst({
      where: { id: receipt.accountingReceiptId, tenantId },
    })
    if (ar && ar.status !== 'CANCELLED' && ar.status !== 'REVERSED') {
      throw new ValidationError('Cancel or reverse the Money In receipt before marking non-accounting')
    }
  }

  const updated = await prisma.crmPaymentReceipt.update({
    where: { id: receipt.id },
    data: {
      commercialOnly: true,
      accountingMigrationStatus: 'NON_ACCOUNTING',
      accountingMigrationError: reason?.trim() || null,
      accountingReceiptId: null,
      updatedBy: userId ?? undefined,
    },
  })

  await createAuditLog({
    tenantId,
    userId: userId ?? null,
    module: 'crm',
    entity: 'crmPaymentReceipt',
    entityId: receipt.id,
    action: 'CRM_RECEIPT_MARKED_NON_ACCOUNTING',
    newValues: { reason: reason ?? null },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return updated
}

/** Mark CRM receipt MIGRATED after Money In receipt post. */
export async function markCrmPaymentReceiptMigratedOnPost(
  tenantId: string,
  customerReceiptId: string,
  userId?: string | null,
): Promise<void> {
  const ar = await prisma.customerReceipt.findFirst({
    where: { id: customerReceiptId, tenantId },
    select: { id: true, sourceType: true, sourceDocumentId: true, status: true },
  })
  if (!ar || ar.sourceType !== 'CRM_PAYMENT_RECEIPT' || !ar.sourceDocumentId) return
  if (ar.status !== 'POSTED') return

  await prisma.crmPaymentReceipt.updateMany({
    where: {
      tenantId,
      id: ar.sourceDocumentId,
      deletedAt: null,
    },
    data: {
      accountingReceiptId: ar.id,
      accountingMigrationStatus: 'MIGRATED',
      accountingMigratedAt: new Date(),
      accountingMigratedBy: userId ?? null,
      commercialOnly: false,
      accountingMigrationError: null,
    },
  })

  await createAuditLog({
    tenantId,
    userId: userId ?? null,
    module: 'crm',
    entity: 'crmPaymentReceipt',
    entityId: ar.sourceDocumentId,
    action: 'CRM_RECEIPT_LINKED_TO_ACCOUNTING',
    newValues: { customerReceiptId: ar.id, status: 'MIGRATED' },
  })
}

export async function listCrmReceiptMigration(
  tenantId: string,
  query: {
    companyId?: string
    status?: string
    migrationStatus?: string
    search?: string
    page?: number
    limit?: number
  },
) {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 50, 100)
  const where: Prisma.CrmPaymentReceiptWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.migrationStatus
      ? { accountingMigrationStatus: query.migrationStatus as never }
      : {}),
    ...(query.search
      ? {
          OR: [
            { receiptNo: { contains: query.search } },
            { customerNameSnapshot: { contains: query.search } },
            { transactionRef: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [total, items] = await Promise.all([
    prisma.crmPaymentReceipt.count({ where }),
    prisma.crmPaymentReceipt.findMany({
      where,
      orderBy: { receiptDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return {
    items: items.map((r) => ({
      id: r.id,
      receiptNo: r.receiptNo,
      receiptDate: dateOnly(r.receiptDate),
      customerId: r.companyId,
      customerName: r.customerNameSnapshot,
      amount: money(r.amount),
      paymentMode: r.paymentMode,
      transactionRef: r.transactionRef,
      commercialOnly: r.commercialOnly,
      accountingMigrationStatus: r.accountingMigrationStatus,
      accountingMigrationError: r.accountingMigrationError,
      accountingReceiptId: r.accountingReceiptId,
      proformaInvoiceId: r.proformaInvoiceId,
      proformaNo: r.proformaNo,
    })),
    total,
    page,
    limit,
  }
}
