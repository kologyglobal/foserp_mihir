import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/prisma/helpers.js'
import type { ListAllocationsQuery, ListInvoicesQuery, ListProformasQuery, ListReceiptsQuery } from './commercial.validation.js'

export async function findCompany(tenantId: string, companyId: string) {
  return prisma.crmCompany.findFirst({
    where: { id: companyId, ...tenantActiveFilter(tenantId) },
  })
}

export async function nextDocumentNo(tenantId: string, prefix: string, table: 'receipt' | 'invoice' | 'proforma') {
  const rows =
    table === 'receipt'
      ? await prisma.crmPaymentReceipt.findMany({
          where: { tenantId, receiptNo: { startsWith: prefix } },
          select: { receiptNo: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : table === 'proforma'
        ? await prisma.crmProformaInvoice.findMany({
            where: { tenantId, proformaNo: { startsWith: prefix } },
            select: { proformaNo: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : await prisma.crmTaxInvoice.findMany({
            where: { tenantId, invoiceNo: { startsWith: prefix } },
            select: { invoiceNo: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
  const nums = rows
    .map((r) => {
      const no = 'receiptNo' in r ? r.receiptNo : 'proformaNo' in r ? r.proformaNo : r.invoiceNo
      const m = no.match(/(\d+)$/)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => Number.isFinite(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(5, '0')}`
}

export async function findReceipts(tenantId: string, query: ListReceiptsQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.CrmPaymentReceiptWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.proformaInvoiceId ? { proformaInvoiceId: query.proformaInvoiceId } : {}),
    ...(query.availableOnly ? { unallocatedAmount: { gt: 0 } } : {}),
  }
  const [total, items] = await Promise.all([
    prisma.crmPaymentReceipt.count({ where }),
    prisma.crmPaymentReceipt.findMany({
      where,
      orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, items }
}

export async function findReceiptById(tenantId: string, id: string) {
  return prisma.crmPaymentReceipt.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
}

export async function sumProformaReceipts(tenantId: string, proformaInvoiceId: string) {
  const agg = await prisma.crmPaymentReceipt.aggregate({
    where: { ...tenantActiveFilter(tenantId), proformaInvoiceId },
    _sum: { amount: true },
  })
  return Number(agg._sum.amount ?? 0)
}

type ReceiptCreateData = Omit<
  Prisma.CrmPaymentReceiptUncheckedCreateInput,
  'tenantId' | 'createdBy' | 'updatedBy'
>

export async function createReceipt(
  tenantId: string,
  userId: string,
  data: ReceiptCreateData,
) {
  return prisma.crmPaymentReceipt.create({
    data: { ...data, tenantId, createdBy: userId, updatedBy: userId },
  })
}

export async function findSalesOrder(tenantId: string, salesOrderId: string) {
  return prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, ...tenantActiveFilter(tenantId) },
  })
}

export async function findActiveProformaForSalesOrder(tenantId: string, salesOrderId: string) {
  return prisma.crmProformaInvoice.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      salesOrderId,
      status: { not: 'cancelled' },
    },
  })
}

export async function findProformas(tenantId: string, query: ListProformasQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.CrmProformaInvoiceWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [total, items] = await Promise.all([
    prisma.crmProformaInvoice.count({ where }),
    prisma.crmProformaInvoice.findMany({
      where,
      include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
      orderBy: [{ proformaDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, items }
}

export async function findProformaById(tenantId: string, id: string) {
  return prisma.crmProformaInvoice.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
  })
}

type ProformaCreateData = Omit<
  Prisma.CrmProformaInvoiceUncheckedCreateInput,
  'tenantId' | 'createdBy' | 'updatedBy'
>

export async function createProformaWithLines(
  tenantId: string,
  userId: string,
  proforma: ProformaCreateData,
  lines: Array<Omit<Prisma.CrmProformaInvoiceLineUncheckedCreateInput, 'tenantId' | 'proformaId'>>,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.crmProformaInvoice.create({
      data: { ...proforma, tenantId, createdBy: userId, updatedBy: userId },
    })
    if (lines.length) {
      await tx.crmProformaInvoiceLine.createMany({
        data: lines.map((l) => ({ ...l, tenantId, proformaId: created.id })),
      })
    }
    return tx.crmProformaInvoice.findFirstOrThrow({
      where: { id: created.id },
      include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
    })
  })
}

export async function updateProformaWithLines(
  tenantId: string,
  id: string,
  userId: string,
  proforma: Prisma.CrmProformaInvoiceUncheckedUpdateInput,
  lines?: Array<Omit<Prisma.CrmProformaInvoiceLineUncheckedCreateInput, 'tenantId' | 'proformaId'>>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmProformaInvoice.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { ...proforma, updatedBy: userId },
    })
    if (lines) {
      await tx.crmProformaInvoiceLine.updateMany({
        where: { proformaId: id, tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      if (lines.length) {
        await tx.crmProformaInvoiceLine.createMany({
          data: lines.map((l) => ({ ...l, tenantId, proformaId: id })),
        })
      }
    }
    return tx.crmProformaInvoice.findFirstOrThrow({
      where: { id },
      include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
    })
  })
}

export async function updateProforma(
  tenantId: string,
  id: string,
  userId: string,
  data: Prisma.CrmProformaInvoiceUncheckedUpdateInput,
) {
  await prisma.crmProformaInvoice.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { ...data, updatedBy: userId },
  })
  return findProformaById(tenantId, id)
}

export async function findInvoices(tenantId: string, query: ListInvoicesQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.CrmTaxInvoiceWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.openOnly
      ? {
          status: { notIn: ['draft', 'cancelled'] },
          balanceDue: { gt: 0 },
        }
      : {}),
  }
  const [total, items] = await Promise.all([
    prisma.crmTaxInvoice.count({ where }),
    prisma.crmTaxInvoice.findMany({
      where,
      include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, items }
}

export async function findInvoiceById(tenantId: string, id: string) {
  return prisma.crmTaxInvoice.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
  })
}

type InvoiceCreateData = Omit<
  Prisma.CrmTaxInvoiceUncheckedCreateInput,
  'tenantId' | 'createdBy' | 'updatedBy'
>

export async function createInvoiceWithLines(
  tenantId: string,
  userId: string,
  invoice: InvoiceCreateData,
  lines: Array<Omit<Prisma.CrmTaxInvoiceLineUncheckedCreateInput, 'tenantId' | 'invoiceId'>>,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.crmTaxInvoice.create({
      data: { ...invoice, tenantId, createdBy: userId, updatedBy: userId },
    })
    if (lines.length) {
      await tx.crmTaxInvoiceLine.createMany({
        data: lines.map((l) => ({ ...l, tenantId, invoiceId: created.id })),
      })
    }
    return tx.crmTaxInvoice.findFirstOrThrow({
      where: { id: created.id },
      include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
    })
  })
}

export async function updateInvoice(
  tenantId: string,
  id: string,
  userId: string,
  data: Prisma.CrmTaxInvoiceUncheckedUpdateInput,
) {
  await prisma.crmTaxInvoice.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { ...data, updatedBy: userId },
  })
  return findInvoiceById(tenantId, id)
}

export async function findAllocations(tenantId: string, query: ListAllocationsQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.CrmPaymentAllocationWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.receiptId ? { receiptId: query.receiptId } : {}),
    ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
    ...(query.includeReversed ? {} : { reversedAt: null }),
  }
  const [total, items] = await Promise.all([
    prisma.crmPaymentAllocation.count({ where }),
    prisma.crmPaymentAllocation.findMany({
      where,
      orderBy: [{ allocationDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, items }
}

export async function findAllocationById(tenantId: string, id: string) {
  return prisma.crmPaymentAllocation.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
}

export async function allocateInTransaction(input: {
  tenantId: string
  userId: string
  receiptId: string
  remainingUnallocated: number
  invoicePatches: Array<{ invoiceId: string; amountPaid: number; balanceDue: number; paymentStatus: 'unpaid' | 'partially_paid' | 'paid'; status: 'posted' | 'partially_paid' | 'paid' }>
  allocations: Array<
    Omit<Prisma.CrmPaymentAllocationUncheckedCreateInput, 'tenantId' | 'createdBy'>
  >
}) {
  return prisma.$transaction(async (tx) => {
    await tx.crmPaymentReceipt.update({
      where: { id: input.receiptId },
      data: { unallocatedAmount: input.remainingUnallocated, updatedBy: input.userId },
    })
    for (const patch of input.invoicePatches) {
      await tx.crmTaxInvoice.update({
        where: { id: patch.invoiceId },
        data: {
          amountPaid: patch.amountPaid,
          balanceDue: patch.balanceDue,
          paymentStatus: patch.paymentStatus,
          status: patch.status,
          updatedBy: input.userId,
        },
      })
    }
    const created = []
    for (const row of input.allocations) {
      created.push(
        await tx.crmPaymentAllocation.create({
          data: { ...row, tenantId: input.tenantId, createdBy: input.userId },
        }),
      )
    }
    return created
  })
}

export async function reverseAllocationInTransaction(input: {
  tenantId: string
  userId: string
  allocationId: string
  receiptId: string
  newUnallocated: number
  invoiceId: string
  amountPaid: number
  balanceDue: number
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid'
  status: 'posted' | 'partially_paid' | 'paid'
}) {
  return prisma.$transaction(async (tx) => {
    const alloc = await tx.crmPaymentAllocation.update({
      where: { id: input.allocationId },
      data: { reversedAt: new Date(), reversedBy: input.userId },
    })
    await tx.crmPaymentReceipt.update({
      where: { id: input.receiptId },
      data: { unallocatedAmount: input.newUnallocated, updatedBy: input.userId },
    })
    await tx.crmTaxInvoice.update({
      where: { id: input.invoiceId },
      data: {
        amountPaid: input.amountPaid,
        balanceDue: input.balanceDue,
        paymentStatus: input.paymentStatus,
        status: input.status,
        updatedBy: input.userId,
      },
    })
    return alloc
  })
}
