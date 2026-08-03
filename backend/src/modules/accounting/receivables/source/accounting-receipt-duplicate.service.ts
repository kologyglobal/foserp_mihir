/**
 * Weighted duplicate detection for CRM payment → Money In customer receipts.
 * Never silently merges; levels EXACT | PROBABLE | POSSIBLE | NONE.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/prisma.js'

export type DuplicateLevel = 'EXACT' | 'PROBABLE' | 'POSSIBLE' | 'NONE'

export type DuplicateMatch = {
  customerReceiptId: string
  receiptNumber: string | null
  draftReference: string | null
  status: string
  receiptDate: string
  amount: string
  score: number
  level: DuplicateLevel
  reasons: string[]
}

export type DuplicateCheckResult = {
  level: DuplicateLevel
  matches: DuplicateMatch[]
  allowCreate: boolean
  requiresOverride: boolean
  message: string | null
}

function dec(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  return v.toNumber()
}

function dateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function normalizeRef(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

function dayDiffAbs(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export type DuplicateCheckInput = {
  tenantId: string
  customerId: string
  amount: number
  currencyCode?: string
  receiptDate: string
  paymentMethod?: string | null
  transactionReference?: string | null
  bankReference?: string | null
  instrumentNumber?: string | null
  /** Exclude this accounting receipt (already linked / itself). */
  excludeCustomerReceiptId?: string | null
  /** Prefer exclude when already known as source. */
  crmPaymentReceiptId?: string | null
}

const EXACT_THRESHOLD = 100
const PROBABLE_THRESHOLD = 70
const POSSIBLE_THRESHOLD = 40

function scoreMatch(
  input: DuplicateCheckInput,
  row: {
    id: string
    status: string
    receiptDate: Date
    currencyCode: string
    paymentMethod: string
    transactionReference: string | null
    customerBankReference: string | null
    chequeNumber: string | null
    bankCashAmount: Prisma.Decimal
    grossReceiptAmount: Prisma.Decimal
    sourceType: string
    sourceDocumentId: string | null
    receiptNumber: string | null
    draftReference: string | null
  },
): DuplicateMatch | null {
  if (input.excludeCustomerReceiptId && row.id === input.excludeCustomerReceiptId) return null
  if (row.status === 'CANCELLED' || row.status === 'REVERSED') return null

  let score = 0
  const reasons: string[] = []

  // Existing source link to this CRM receipt = exact (same commercial document).
  if (
    input.crmPaymentReceiptId &&
    row.sourceType === 'CRM_PAYMENT_RECEIPT' &&
    row.sourceDocumentId === input.crmPaymentReceiptId
  ) {
    score = 100
    reasons.push('Already linked as CRM payment receipt source')
  }

  const currency = (input.currencyCode ?? 'INR').toUpperCase()
  if (row.currencyCode.toUpperCase() === currency) {
    score += 5
  } else {
    return null
  }

  const amount = dec(row.grossReceiptAmount) || dec(row.bankCashAmount)
  if (Math.abs(amount - input.amount) < 0.01) {
    score += 35
    reasons.push('Same amount')
  } else if (Math.abs(amount - input.amount) / Math.max(input.amount, 1) < 0.02) {
    score += 15
    reasons.push('Near amount (±2%)')
  } else {
    return null
  }

  const rowDate = dateOnly(row.receiptDate)
  const days = dayDiffAbs(rowDate, input.receiptDate)
  if (days === 0) {
    score += 25
    reasons.push('Same receipt date')
  } else if (days <= 2) {
    score += 15
    reasons.push(`Close receipt date (${days}d)`)
  } else if (days <= 7) {
    score += 8
    reasons.push(`Nearby receipt date (${days}d)`)
  }

  const inTx = normalizeRef(input.transactionReference)
  const rowTx = normalizeRef(row.transactionReference)
  if (inTx && rowTx && inTx === rowTx) {
    score += 40
    reasons.push('Matching transaction reference')
  }

  const inBank = normalizeRef(input.bankReference)
  const rowBank = normalizeRef(row.customerBankReference)
  if (inBank && rowBank && inBank === rowBank) {
    score += 30
    reasons.push('Matching bank reference')
  }

  const inInst = normalizeRef(input.instrumentNumber)
  const rowInst = normalizeRef(row.chequeNumber)
  if (inInst && rowInst && inInst === rowInst) {
    score += 30
    reasons.push('Matching instrument/cheque number')
  }

  if (input.paymentMethod && row.paymentMethod === input.paymentMethod) {
    score += 5
    reasons.push('Same payment method')
  }

  if (score < POSSIBLE_THRESHOLD) return null

  let level: DuplicateLevel = 'POSSIBLE'
  if (score >= EXACT_THRESHOLD) level = 'EXACT'
  else if (score >= PROBABLE_THRESHOLD) level = 'PROBABLE'

  return {
    customerReceiptId: row.id,
    receiptNumber: row.receiptNumber,
    draftReference: row.draftReference,
    status: row.status,
    receiptDate: rowDate,
    amount: amount.toFixed(2),
    score,
    level,
    reasons,
  }
}

export async function checkCustomerReceiptDuplicates(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const windowStart = new Date(input.receiptDate)
  windowStart.setUTCDate(windowStart.getUTCDate() - 14)
  const windowEnd = new Date(input.receiptDate)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14)

  const amount = input.amount
  const low = new Prisma.Decimal((amount * 0.98).toFixed(2))
  const high = new Prisma.Decimal((amount * 1.02).toFixed(2))

  const candidates = await prisma.customerReceipt.findMany({
    where: {
      tenantId: input.tenantId,
      customerId: input.customerId,
      status: { notIn: ['CANCELLED', 'REVERSED'] },
      receiptDate: { gte: windowStart, lte: windowEnd },
      OR: [
        { grossReceiptAmount: { gte: low, lte: high } },
        { bankCashAmount: { gte: low, lte: high } },
        ...(input.transactionReference
          ? [{ transactionReference: input.transactionReference }]
          : []),
        ...(input.crmPaymentReceiptId
          ? [
              {
                sourceType: 'CRM_PAYMENT_RECEIPT' as const,
                sourceDocumentId: input.crmPaymentReceiptId,
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      status: true,
      receiptDate: true,
      currencyCode: true,
      paymentMethod: true,
      transactionReference: true,
      customerBankReference: true,
      chequeNumber: true,
      bankCashAmount: true,
      grossReceiptAmount: true,
      sourceType: true,
      sourceDocumentId: true,
      receiptNumber: true,
      draftReference: true,
    },
    take: 50,
  })

  const matches = candidates
    .map((row) => scoreMatch(input, row))
    .filter((m): m is DuplicateMatch => m != null)
    .sort((a, b) => b.score - a.score)

  const topLevel: DuplicateLevel =
    matches.length === 0
      ? 'NONE'
      : matches.some((m) => m.level === 'EXACT')
        ? 'EXACT'
        : matches.some((m) => m.level === 'PROBABLE')
          ? 'PROBABLE'
          : 'POSSIBLE'

  if (topLevel === 'EXACT') {
    return {
      level: 'EXACT',
      matches,
      allowCreate: false,
      requiresOverride: false,
      message:
        'Exact duplicate found in Money In. Open the existing accounting receipt or mark this CRM receipt as non-accounting.',
    }
  }
  if (topLevel === 'PROBABLE') {
    return {
      level: 'PROBABLE',
      matches,
      allowCreate: false,
      requiresOverride: true,
      message:
        'Probable duplicate detected. Override with reason requires elevated permission.',
    }
  }
  if (topLevel === 'POSSIBLE') {
    return {
      level: 'POSSIBLE',
      matches,
      allowCreate: true,
      requiresOverride: false,
      message: 'Possible similar receipt found in Money In — review before posting.',
    }
  }
  return {
    level: 'NONE',
    matches: [],
    allowCreate: true,
    requiresOverride: false,
    message: null,
  }
}
