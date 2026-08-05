/**
 * Phase 8 — GST liability proposal / PMT-06 style payment challan (books-side).
 * Propose from gst_ledger_entries; confirm external CIN/CPIN; optional GL settle via central post().
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError, NotFoundError, AppError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import { post } from '../posting/posting.service.js'
import { loadLedgerRowsForPeriod } from './gst-registers.service.js'
import {
  buildLiabilityProposal,
  canClosePeriod,
  canConfirmExternal,
  canPostGl,
  canProposePayment,
  canVoidChallan,
  distributeCashSettlement,
  type GstPaymentChallanStatus,
} from './gst-payment-liability.util.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

function money(v: { toString(): string } | number | string): string {
  return formatForPersistence(v.toString(), 4)
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function serialize(row: {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  status: string
  outputCgst: { toString(): string }
  outputSgst: { toString(): string }
  outputIgst: { toString(): string }
  outputCess: { toString(): string }
  rcmCgst: { toString(): string }
  rcmSgst: { toString(): string }
  rcmIgst: { toString(): string }
  rcmCess: { toString(): string }
  itcCgst: { toString(): string }
  itcSgst: { toString(): string }
  itcIgst: { toString(): string }
  itcCess: { toString(): string }
  totalLiability: { toString(): string }
  totalItc: { toString(): string }
  netTaxPayable: { toString(): string }
  interestAmount: { toString(): string }
  lateFeeAmount: { toString(): string }
  roundOffAmount: { toString(): string }
  totalPayable: { toString(): string }
  cashLedgerJson: unknown
  creditLedgerJson: unknown
  liabilitySnapshotJson: unknown
  cpin: string | null
  challanNumber: string | null
  bankReference: string | null
  paymentDate: Date | null
  bankAccountId: string | null
  remarks: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  proposedAt: Date | null
  confirmedAt: Date | null
  postedAt: Date | null
  closedAt: Date | null
  voidedAt: Date | null
  voidReason: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.returnPeriod,
    status: row.status,
    outputCgst: money(row.outputCgst),
    outputSgst: money(row.outputSgst),
    outputIgst: money(row.outputIgst),
    outputCess: money(row.outputCess),
    rcmCgst: money(row.rcmCgst),
    rcmSgst: money(row.rcmSgst),
    rcmIgst: money(row.rcmIgst),
    rcmCess: money(row.rcmCess),
    itcCgst: money(row.itcCgst),
    itcSgst: money(row.itcSgst),
    itcIgst: money(row.itcIgst),
    itcCess: money(row.itcCess),
    totalLiability: money(row.totalLiability),
    totalItc: money(row.totalItc),
    netTaxPayable: money(row.netTaxPayable),
    interestAmount: money(row.interestAmount),
    lateFeeAmount: money(row.lateFeeAmount),
    roundOffAmount: money(row.roundOffAmount),
    totalPayable: money(row.totalPayable),
    cashLedgerJson: row.cashLedgerJson ?? null,
    creditLedgerJson: row.creditLedgerJson ?? null,
    liabilitySnapshotJson: row.liabilitySnapshotJson ?? null,
    cpin: row.cpin,
    challanNumber: row.challanNumber,
    bankReference: row.bankReference,
    paymentDate: row.paymentDate?.toISOString().slice(0, 10) ?? null,
    bankAccountId: row.bankAccountId,
    remarks: row.remarks,
    accountingVoucherId: row.accountingVoucherId,
    postingEventId: row.postingEventId,
    proposedAt: row.proposedAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    postedAt: row.postedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    disclaimer:
      'Books-side PMT-06 style record only. Not portal challan generate / cash-ledger live balance / GSTR filing.',
  }
}

export async function listPaymentChallans(
  req: Request,
  tenantId: string,
  query: {
    legalEntityId: string
    returnPeriod?: string
    companyGstin?: string
    page: number
    pageSize: number
  },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.returnPeriod ? { returnPeriod: query.returnPeriod } : {}),
    ...(query.companyGstin ? { companyGstin: query.companyGstin.trim().toUpperCase() } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstPaymentChallan.count({ where }),
    prisma.gstPaymentChallan.findMany({
      where,
      orderBy: [{ returnPeriod: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(serialize), total, page: query.page, pageSize: query.pageSize }
}

export async function getPaymentChallan(req: Request, tenantId: string, id: string) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare')
  const row = await prisma.gstPaymentChallan.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST payment challan not found')
  return serialize(row)
}

export async function previewLiability(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    returnPeriod: string
    companyGstin?: string
    interestAmount?: number
    lateFeeAmount?: number
    roundOffAmount?: number
  },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare')
  const le = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const gstin = (input.companyGstin ?? le.gstin ?? '').trim().toUpperCase()
  if (!gstin) {
    throw new AppError(422, 'Legal entity GSTIN is required for GST payment liability', 'GST_PAYMENT_GSTIN')
  }
  const rows = await loadLedgerRowsForPeriod({
    tenantId,
    legalEntityId: input.legalEntityId,
    returnPeriod: input.returnPeriod,
    companyGstin: gstin,
  })
  return {
    companyGstin: gstin,
    returnPeriod: input.returnPeriod,
    proposal: buildLiabilityProposal(rows, {
      interestAmount: input.interestAmount,
      lateFeeAmount: input.lateFeeAmount,
      roundOffAmount: input.roundOffAmount,
    }),
    ledgerRowCount: rows.length,
  }
}

export async function proposePaymentChallan(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    returnPeriod: string
    companyGstin?: string
    interestAmount?: number
    lateFeeAmount?: number
    roundOffAmount?: number
    remarks?: string
  },
) {
  assertAny(req, 'tax.gst.payment.prepare')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  const le = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const gstin = (input.companyGstin ?? le.gstin ?? '').trim().toUpperCase()
  if (!gstin) {
    throw new AppError(422, 'Legal entity GSTIN is required', 'GST_PAYMENT_GSTIN')
  }

  const existing = await prisma.gstPaymentChallan.findMany({
    where: {
      tenantId,
      legalEntityId: input.legalEntityId,
      companyGstin: gstin,
      returnPeriod: input.returnPeriod,
    },
    select: { status: true },
  })
  const gate = canProposePayment(existing.map((e) => e.status as GstPaymentChallanStatus))
  if (!gate.ok) throw new AppError(422, gate.reason ?? 'Cannot propose', 'GST_PAYMENT_STATE')

  const rows = await loadLedgerRowsForPeriod({
    tenantId,
    legalEntityId: input.legalEntityId,
    returnPeriod: input.returnPeriod,
    companyGstin: gstin,
  })
  const proposal = buildLiabilityProposal(rows, {
    interestAmount: input.interestAmount,
    lateFeeAmount: input.lateFeeAmount,
    roundOffAmount: input.roundOffAmount,
  })

  const now = new Date()
  const row = await prisma.gstPaymentChallan.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      companyGstin: gstin,
      returnPeriod: input.returnPeriod,
      status: 'PROPOSED',
      outputCgst: proposal.output.cgst,
      outputSgst: proposal.output.sgst,
      outputIgst: proposal.output.igst,
      outputCess: proposal.output.cess,
      rcmCgst: proposal.rcm.cgst,
      rcmSgst: proposal.rcm.sgst,
      rcmIgst: proposal.rcm.igst,
      rcmCess: proposal.rcm.cess,
      itcCgst: proposal.itc.cgst,
      itcSgst: proposal.itc.sgst,
      itcIgst: proposal.itc.igst,
      itcCess: proposal.itc.cess,
      totalLiability: proposal.totalLiability,
      totalItc: proposal.totalItc,
      netTaxPayable: proposal.netTaxPayable,
      interestAmount: proposal.interestAmount,
      lateFeeAmount: proposal.lateFeeAmount,
      roundOffAmount: proposal.roundOffAmount,
      totalPayable: proposal.totalPayable,
      cashLedgerJson: asJson(proposal.cashLedgerProposal),
      creditLedgerJson: asJson(proposal.creditLedgerProposal),
      liabilitySnapshotJson: asJson(proposal),
      remarks: input.remarks?.trim() || null,
      proposedAt: now,
      proposedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_payment_challan',
    entityId: row.id,
    action: 'PROPOSE',
    newValues: {
      returnPeriod: input.returnPeriod,
      totalPayable: proposal.totalPayable,
      ledgerRows: rows.length,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(row)
}

export async function confirmPaymentExternal(
  req: Request,
  tenantId: string,
  id: string,
  input: {
    paymentDate: string
    cpin?: string
    challanNumber?: string
    bankReference?: string
    remarks?: string
  },
) {
  assertAny(req, 'tax.gst.payment.confirm')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstPaymentChallan.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST payment challan not found')
  if (!canConfirmExternal(row.status as GstPaymentChallanStatus)) {
    throw new AppError(422, `Cannot confirm external payment from status ${row.status}`, 'GST_PAYMENT_STATE')
  }

  const updated = await prisma.gstPaymentChallan.update({
    where: { id: row.id },
    data: {
      status: 'CONFIRMED_EXTERNAL',
      paymentDate: parseDateOnly(input.paymentDate),
      cpin: input.cpin?.trim() || null,
      challanNumber: input.challanNumber?.trim() || null,
      bankReference: input.bankReference?.trim() || null,
      remarks: input.remarks?.trim() || row.remarks,
      confirmedAt: new Date(),
      confirmedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_payment_challan',
    entityId: row.id,
    action: 'CONFIRM_EXTERNAL',
    newValues: { cpin: updated.cpin, challanNumber: updated.challanNumber, paymentDate: input.paymentDate },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}

export async function postPaymentToGl(
  req: Request,
  tenantId: string,
  id: string,
  input: { bankAccountId: string; postingDate?: string },
) {
  assertAny(req, 'tax.gst.payment.post')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstPaymentChallan.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST payment challan not found')
  if (!canPostGl(row.status as GstPaymentChallanStatus)) {
    throw new AppError(422, `Cannot post GL from status ${row.status}`, 'GST_PAYMENT_STATE')
  }
  if (row.accountingVoucherId) {
    return serialize(row)
  }

  const bank = await prisma.chartOfAccount.findFirst({
    where: { id: input.bankAccountId, tenantId, isActive: true },
  })
  if (!bank) throw new AppError(422, 'Bank account not found for this tenant', 'GST_PAYMENT_BANK')

  const netTax = Number(row.netTaxPayable)
  const interest = Number(row.interestAmount)
  const lateFee = Number(row.lateFeeAmount)
  const roundOff = Number(row.roundOffAmount)
  const totalPayable = Number(row.totalPayable)
  if (totalPayable <= 0) {
    throw new AppError(422, 'Nothing to post — total payable is zero', 'GST_PAYMENT_ZERO')
  }

  const cashRaw = (row.cashLedgerJson ?? {}) as {
    igst?: number
    cgst?: number
    sgst?: number
    cess?: number
  }
  const cash = distributeCashSettlement(
    {
      igst: Number(cashRaw.igst ?? 0),
      cgst: Number(cashRaw.cgst ?? 0),
      sgst: Number(cashRaw.sgst ?? 0),
      cess: Number(cashRaw.cess ?? 0),
    },
    netTax,
  )

  const lines: Array<{
    lineNumber: number
    accountId?: string
    accountMappingKey?: string
    debitAmount: string
    creditAmount: string
    lineNarration?: string
  }> = []
  let ln = 1

  const mapDebit = (key: string, amount: number, label: string) => {
    if (amount <= 0.00005) return
    lines.push({
      lineNumber: ln++,
      accountMappingKey: key,
      debitAmount: formatForPersistence(amount, 4),
      creditAmount: '0.0000',
      lineNarration: `GST settle ${label} ${row.returnPeriod}`,
    })
  }

  mapDebit('GST_OUTPUT_IGST', cash.igst, 'IGST')
  mapDebit('GST_OUTPUT_CGST', cash.cgst, 'CGST')
  mapDebit('GST_OUTPUT_SGST', cash.sgst, 'SGST')
  mapDebit('GST_OUTPUT_CESS', cash.cess, 'CESS')
  if (interest > 0) mapDebit('GST_INTEREST', interest, 'Interest')
  if (lateFee > 0) mapDebit('GST_LATE_FEE', lateFee, 'Late fee')
  if (roundOff > 0.00005) {
    // Prefer GST_ROUND_OFF if mapped; amount absorbed into bank credit.
    mapDebit('GST_ROUND_OFF', roundOff, 'Round off')
  }

  // If mapping-based debits are empty (e.g. only RCM cash with no output split), fail clearly.
  const debitSum = lines.reduce((s, l) => s + Number(l.debitAmount), 0)
  if (debitSum <= 0) {
    throw new AppError(
      422,
      'Cannot build debit legs for GST settlement — map GST_OUTPUT_* / GST_INTEREST / GST_LATE_FEE and re-propose with liability',
      'GST_PAYMENT_ACCOUNTS',
    )
  }

  // Bank credit must equal debit sum (use computed debit total to keep voucher balanced).
  lines.push({
    lineNumber: ln++,
    accountId: bank.id,
    debitAmount: '0.0000',
    creditAmount: formatForPersistence(debitSum, 4),
    lineNarration: `GST payment bank ${row.returnPeriod} ${row.cpin ?? row.challanNumber ?? ''}`.trim(),
  })

  const postingDate = input.postingDate ?? row.paymentDate?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const result = await post(
    {
      legalEntityId: row.legalEntityId,
      eventKey: `gst-payment-challan:${row.id}`,
      eventType: 'GST_PAYMENT_CHALLAN',
      postingPurpose: 'SYSTEM_DOCUMENT',
      voucherType: 'PAYMENT',
      documentDate: postingDate,
      postingDate,
      referenceNumber: row.challanNumber ?? row.cpin ?? row.id.slice(0, 8),
      externalReference: row.cpin,
      narration: `GST payment settlement ${row.returnPeriod} ${row.companyGstin}`,
      sourceModule: 'tax-compliance',
      sourceDocumentType: 'GST_PAYMENT_CHALLAN',
      sourceDocumentId: row.id,
      lines,
    },
    {
      tenantId,
      userId,
      authorization: { permissionChecked: true },
      workflow: { workflowSatisfied: true },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    },
  )

  const updated = await prisma.gstPaymentChallan.update({
    where: { id: row.id },
    data: {
      status: 'POSTED_GL',
      bankAccountId: bank.id,
      accountingVoucherId: result.voucherId,
      postingEventId: result.postingEventId,
      postedAt: new Date(),
      postedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_payment_challan',
    entityId: row.id,
    action: 'POST_GL',
    newValues: { voucherId: result.voucherId, voucherNumber: result.voucherNumber },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}

export async function closePaymentPeriod(req: Request, tenantId: string, id: string) {
  assertAny(req, 'tax.gst.payment.close')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstPaymentChallan.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST payment challan not found')
  if (!canClosePeriod(row.status as GstPaymentChallanStatus)) {
    throw new AppError(
      422,
      `Cannot close period from status ${row.status} — confirm external and/or post GL first`,
      'GST_PAYMENT_STATE',
    )
  }

  const updated = await prisma.gstPaymentChallan.update({
    where: { id: row.id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_payment_challan',
    entityId: row.id,
    action: 'CLOSE_PERIOD',
    newValues: { returnPeriod: row.returnPeriod, companyGstin: row.companyGstin },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}

export async function voidPaymentChallan(
  req: Request,
  tenantId: string,
  id: string,
  input: { reason: string },
) {
  assertAny(req, 'tax.gst.payment.prepare', 'tax.gst.payment.confirm')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstPaymentChallan.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST payment challan not found')
  if (!canVoidChallan(row.status as GstPaymentChallanStatus)) {
    throw new AppError(422, `Cannot void challan in status ${row.status}`, 'GST_PAYMENT_STATE')
  }

  const updated = await prisma.gstPaymentChallan.update({
    where: { id: row.id },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidedBy: userId,
      voidReason: input.reason.trim().slice(0, 500),
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_payment_challan',
    entityId: row.id,
    action: 'VOID',
    newValues: { reason: input.reason },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}
