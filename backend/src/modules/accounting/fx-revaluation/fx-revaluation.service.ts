/**
 * Period-close unrealized FX revaluation.
 * MVP: AR/AP open items in foreign currency × closing rate → base adjusting journal.
 * Out of scope: treasury cross-currency transfers, live bank FX feeds, realized FX on allocation.
 */
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { resolveNextPeriod } from '../period-adjustments/period-adjustment.service.js'
import { isMultiCurrencyEnabled } from '../posting/posting-currency.service.js'
import { post } from '../posting/posting.service.js'
import { PostingError } from '../posting/posting.errors.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import {
  add,
  compare,
  formatForPersistence,
  isZero,
  multiply,
  subtract,
  toDecimal,
} from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { FX_REVAL_ERROR_CODES as CODES, unprocessable } from './fx-revaluation.errors.js'
import type { ListFxRatesQuery, ReverseFxRunInput, UpsertFxRateInput } from './fx-revaluation.schemas.js'

const ZERO = '0.0000'
const SOURCE_MODULE = 'ACCOUNTING'
const SOURCE_DOCUMENT_TYPE = 'FX_REVALUATION'

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function audit(req: Request, tenantId: string, id: string, action: string, values?: Record<string, unknown>) {
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'ACCOUNTING',
    entity: 'FxRevaluationRun',
    entityId: id,
    action,
    newValues: values,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  })
}

function postingContext(req: Request, tenantId: string): PostingContext {
  return {
    tenantId,
    userId: req.context?.userId ?? null,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  }
}

async function resolveMappedAccount(
  tenantId: string,
  legalEntityId: string,
  mappingKey: 'UNREALIZED_FX_GAIN' | 'UNREALIZED_FX_LOSS' | 'CUSTOMER_RECEIVABLE' | 'VENDOR_PAYABLE',
) {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    select: {
      accountId: true,
      account: { select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true } },
    },
  })
  const account = mapping?.account
  if (!account || !account.isActive || account.isGroup) {
    throw unprocessable(
      `Default account mapping ${mappingKey} is missing or inactive`,
      CODES.MAPPING_MISSING,
      { mappingKey },
    )
  }
  return account
}

/** Latest rate with asOfDate <= asOf for the currency. */
export async function resolveClosingRate(
  tenantId: string,
  legalEntityId: string,
  currencyCode: string,
  asOf: Date,
): Promise<Prisma.Decimal | null> {
  const row = await prisma.fxExchangeRate.findFirst({
    where: {
      tenantId,
      legalEntityId,
      currencyCode: currencyCode.toUpperCase(),
      asOfDate: { lte: asOf },
    },
    orderBy: { asOfDate: 'desc' },
  })
  return row?.rate ?? null
}

export async function listFxRates(tenantId: string, query: ListFxRatesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.FxExchangeRateWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.currencyCode ? { currencyCode: query.currencyCode.toUpperCase() } : {}),
    ...(query.asOfDate ? { asOfDate: parseDateOnly(query.asOfDate) } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.fxExchangeRate.findMany({ where, orderBy: [{ asOfDate: 'desc' }, { currencyCode: 'asc' }], skip, take }),
    prisma.fxExchangeRate.count({ where }),
  ])
  return {
    items: items.map((r) => ({
      id: r.id,
      legalEntityId: r.legalEntityId,
      currencyCode: r.currencyCode,
      asOfDate: toIsoDate(r.asOfDate),
      rate: formatForPersistence(r.rate, 4),
      source: r.source,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}

export async function upsertFxRate(req: Request, tenantId: string, input: UpsertFxRateInput) {
  const le = await prisma.legalEntity.findFirst({ where: { id: input.legalEntityId, tenantId }, select: { id: true } })
  if (!le) throw new NotFoundError('Legal entity not found')
  const asOfDate = parseDateOnly(input.asOfDate)
  const row = await prisma.fxExchangeRate.upsert({
    where: {
      legalEntityId_currencyCode_asOfDate: {
        legalEntityId: input.legalEntityId,
        currencyCode: input.currencyCode,
        asOfDate,
      },
    },
    create: {
      tenantId,
      legalEntityId: input.legalEntityId,
      currencyCode: input.currencyCode,
      asOfDate,
      rate: input.rate,
      notes: input.notes ?? null,
      createdBy: req.context?.userId ?? null,
    },
    update: {
      rate: input.rate,
      notes: input.notes ?? null,
      updatedBy: req.context?.userId ?? null,
    },
  })
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    currencyCode: row.currencyCode,
    asOfDate: toIsoDate(row.asOfDate),
    rate: formatForPersistence(row.rate, 4),
    source: row.source,
    notes: row.notes,
  }
}

const runInclude = {
  lines: { orderBy: { lineNumber: 'asc' as const } },
  period: { select: { id: true, name: true, endDate: true, status: true } },
  reversalPeriod: { select: { id: true, name: true, startDate: true } },
} satisfies Prisma.FxRevaluationRunInclude

function serializeRun(
  row: Prisma.FxRevaluationRunGetPayload<{ include: typeof runInclude }>,
) {
  return {
    id: row.id,
    status: row.status,
    legalEntityId: row.legalEntityId,
    periodId: row.periodId,
    periodName: row.period.name,
    asOfDate: toIsoDate(row.asOfDate),
    baseCurrency: row.baseCurrency,
    totalGain: formatForPersistence(row.totalGain, 4),
    totalLoss: formatForPersistence(row.totalLoss, 4),
    netGainLoss: formatForPersistence(row.netGainLoss, 4),
    exchangeGainAccount: row.gainAccountCode
      ? `${row.gainAccountCode} ${row.gainAccountName ?? ''}`.trim()
      : null,
    exchangeLossAccount: row.lossAccountCode
      ? `${row.lossAccountCode} ${row.lossAccountName ?? ''}`.trim()
      : null,
    gainAccountId: row.gainAccountId,
    lossAccountId: row.lossAccountId,
    reversalPeriod: row.reversalPeriod
      ? { id: row.reversalPeriod.id, name: row.reversalPeriod.name, startDate: toIsoDate(row.reversalPeriod.startDate) }
      : null,
    voucherId: row.voucherId,
    voucherNumber: row.voucherNumber,
    reversalVoucherNumber: row.reversalVoucherNumber,
    postedAt: row.postedAt?.toISOString() ?? null,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    lines: row.lines.map((l) => ({
      id: l.id,
      accountOrParty: l.accountOrParty,
      currency: l.currencyCode,
      foreignAmount: Number(formatForPersistence(l.foreignAmount, 4)),
      originalRate: Number(formatForPersistence(l.originalRate, 4)),
      closingRate: Number(formatForPersistence(l.closingRate, 4)),
      bookValueInr: Number(formatForPersistence(l.bookValueBase, 4)),
      revaluedValueInr: Number(formatForPersistence(l.revaluedValueBase, 4)),
      gainLoss: Number(formatForPersistence(l.gainLossBase, 4)),
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      isAsset: l.isAsset,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getFxRunForPeriod(tenantId: string, periodId: string) {
  const row = await prisma.fxRevaluationRun.findFirst({
    where: { tenantId, periodId },
    include: runInclude,
  })
  return row ? serializeRun(row) : null
}

type BuiltLine = {
  sourceType: 'AR_OPEN_ITEM' | 'AP_OPEN_ITEM'
  sourceId: string
  accountOrParty: string
  glAccountId: string
  currencyCode: string
  foreignAmount: string
  originalRate: string
  closingRate: string
  bookValueBase: string
  revaluedValueBase: string
  gainLossBase: string
  isAsset: boolean
}

async function buildPreviewLines(
  tenantId: string,
  legalEntityId: string,
  baseCurrency: string,
  asOf: Date,
  arControlId: string,
  apControlId: string,
): Promise<BuiltLine[]> {
  const lines: BuiltLine[] = []
  const rateCache = new Map<string, Prisma.Decimal>()

  async function closingRateFor(currency: string): Promise<Prisma.Decimal> {
    const key = currency.toUpperCase()
    if (rateCache.has(key)) return rateCache.get(key)!
    const rate = await resolveClosingRate(tenantId, legalEntityId, key, asOf)
    if (!rate) {
      throw unprocessable(
        `No FX closing rate for ${key} as of ${toIsoDate(asOf)}. Upsert a rate under FX rates first.`,
        CODES.RATE_MISSING,
        { currencyCode: key, asOfDate: toIsoDate(asOf) },
      )
    }
    rateCache.set(key, rate)
    return rate
  }

  const arItems = await prisma.receivableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      side: 'DEBIT',
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      currencyCode: { not: baseCurrency },
      openAmount: { gt: 0 },
    },
  })

  for (const item of arItems) {
    const closing = await closingRateFor(item.currencyCode)
    const foreign = toDecimal(item.openAmount)
    const book = toDecimal(item.baseOpenAmount)
    const revalued = multiply(foreign, closing)
    const gainLoss = subtract(revalued, book)
    if (isZero(gainLoss)) continue
    lines.push({
      sourceType: 'AR_OPEN_ITEM',
      sourceId: item.id,
      accountOrParty: item.customerNameSnapshot
        ? `${item.customerNameSnapshot} (Customer)`
        : `Customer ${item.customerId}`,
      glAccountId: item.receivableAccountId ?? arControlId,
      currencyCode: item.currencyCode,
      foreignAmount: formatForPersistence(foreign, 4),
      originalRate: formatForPersistence(item.exchangeRate, 4),
      closingRate: formatForPersistence(closing, 4),
      bookValueBase: formatForPersistence(book, 4),
      revaluedValueBase: formatForPersistence(revalued, 4),
      gainLossBase: formatForPersistence(gainLoss, 4),
      isAsset: true,
    })
  }

  const apItems = await prisma.payableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      side: 'CREDIT',
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      currencyCode: { not: baseCurrency },
      outstandingAmount: { gt: 0 },
    },
  })

  for (const item of apItems) {
    const closing = await closingRateFor(item.currencyCode)
    const foreign = toDecimal(item.outstandingAmount)
    const book = toDecimal(item.baseOutstandingAmount)
    const revalued = multiply(foreign, closing)
    // Liability: economic gain when revalued base is lower than book.
    const gainLoss = subtract(book, revalued)
    if (isZero(gainLoss)) continue
    lines.push({
      sourceType: 'AP_OPEN_ITEM',
      sourceId: item.id,
      accountOrParty: `${item.vendorNameSnapshot} (Vendor)`,
      glAccountId: item.vendorPayableAccountId || apControlId,
      currencyCode: item.currencyCode,
      foreignAmount: formatForPersistence(foreign, 4),
      originalRate: formatForPersistence(item.exchangeRate, 4),
      closingRate: formatForPersistence(closing, 4),
      bookValueBase: formatForPersistence(book, 4),
      revaluedValueBase: formatForPersistence(revalued, 4),
      gainLossBase: formatForPersistence(gainLoss, 4),
      isAsset: false,
    })
  }

  return lines
}

export async function previewFxRevaluation(req: Request, tenantId: string, periodId: string) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } })
  if (!period) throw new NotFoundError('Accounting period not found')

  const enabled = await isMultiCurrencyEnabled(tenantId, period.legalEntityId)
  if (!enabled) {
    throw unprocessable(
      'MULTI_CURRENCY is not enabled for this legal entity. Enable it under Finance Features before FX revaluation.',
      CODES.MULTI_CURRENCY_OFF,
    )
  }

  const existing = await prisma.fxRevaluationRun.findFirst({ where: { tenantId, periodId } })
  if (existing && (existing.status === 'POSTED' || existing.status === 'REVERSED')) {
    return serializeRun(
      await prisma.fxRevaluationRun.findFirstOrThrow({ where: { id: existing.id }, include: runInclude }),
    )
  }

  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: period.legalEntityId },
  })
  if (!settings?.financeActivated) {
    throw unprocessable('Finance is not activated for this legal entity', CODES.NOT_EDITABLE)
  }
  const baseCurrency = settings.baseCurrency || 'INR'
  const asOf = period.endDate

  const [gainAccount, lossAccount, arControl, apControl] = await Promise.all([
    resolveMappedAccount(tenantId, period.legalEntityId, 'UNREALIZED_FX_GAIN'),
    resolveMappedAccount(tenantId, period.legalEntityId, 'UNREALIZED_FX_LOSS'),
    resolveMappedAccount(tenantId, period.legalEntityId, 'CUSTOMER_RECEIVABLE'),
    resolveMappedAccount(tenantId, period.legalEntityId, 'VENDOR_PAYABLE'),
  ])

  const built = await buildPreviewLines(
    tenantId,
    period.legalEntityId,
    baseCurrency,
    asOf,
    arControl.id,
    apControl.id,
  )

  let totalGain = toDecimal(0)
  let totalLoss = toDecimal(0)
  for (const line of built) {
    const gl = toDecimal(line.gainLossBase)
    if (compare(gl, 0) > 0) totalGain = add(totalGain, gl)
    else if (compare(gl, 0) < 0) totalLoss = add(totalLoss, toDecimal(gl.abs()))
  }
  const net = subtract(totalGain, totalLoss)

  const nextPeriod = await resolveNextPeriod(tenantId, period.legalEntityId, period)
  const userId = req.context?.userId ?? null

  const run = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.fxRevaluationLine.deleteMany({ where: { runId: existing.id } })
      return tx.fxRevaluationRun.update({
        where: { id: existing.id },
        data: {
          status: 'PREVIEWED',
          asOfDate: asOf,
          baseCurrency,
          totalGain: formatForPersistence(totalGain, 4),
          totalLoss: formatForPersistence(totalLoss, 4),
          netGainLoss: formatForPersistence(net, 4),
          gainAccountId: gainAccount.id,
          lossAccountId: lossAccount.id,
          gainAccountCode: gainAccount.accountCode,
          gainAccountName: gainAccount.accountName,
          lossAccountCode: lossAccount.accountCode,
          lossAccountName: lossAccount.accountName,
          reversalPeriodId: nextPeriod?.id ?? null,
          updatedBy: userId,
          lines: {
            create: built.map((l, i) => ({
              tenantId,
              lineNumber: i + 1,
              sourceType: l.sourceType,
              sourceId: l.sourceId,
              accountOrParty: l.accountOrParty,
              glAccountId: l.glAccountId,
              currencyCode: l.currencyCode,
              foreignAmount: l.foreignAmount,
              originalRate: l.originalRate,
              closingRate: l.closingRate,
              bookValueBase: l.bookValueBase,
              revaluedValueBase: l.revaluedValueBase,
              gainLossBase: l.gainLossBase,
              isAsset: l.isAsset,
            })),
          },
        },
        include: runInclude,
      })
    }

    return tx.fxRevaluationRun.create({
      data: {
        tenantId,
        legalEntityId: period.legalEntityId,
        periodId,
        status: 'PREVIEWED',
        asOfDate: asOf,
        baseCurrency,
        totalGain: formatForPersistence(totalGain, 4),
        totalLoss: formatForPersistence(totalLoss, 4),
        netGainLoss: formatForPersistence(net, 4),
        gainAccountId: gainAccount.id,
        lossAccountId: lossAccount.id,
        gainAccountCode: gainAccount.accountCode,
        gainAccountName: gainAccount.accountName,
        lossAccountCode: lossAccount.accountCode,
        lossAccountName: lossAccount.accountName,
        reversalPeriodId: nextPeriod?.id ?? null,
        createdBy: userId,
        lines: {
          create: built.map((l, i) => ({
            tenantId,
            lineNumber: i + 1,
            sourceType: l.sourceType,
            sourceId: l.sourceId,
            accountOrParty: l.accountOrParty,
            glAccountId: l.glAccountId,
            currencyCode: l.currencyCode,
            foreignAmount: l.foreignAmount,
            originalRate: l.originalRate,
            closingRate: l.closingRate,
            bookValueBase: l.bookValueBase,
            revaluedValueBase: l.revaluedValueBase,
            gainLossBase: l.gainLossBase,
            isAsset: l.isAsset,
          })),
        },
      },
      include: runInclude,
    })
  })

  await audit(req, tenantId, run.id, 'FX_REVAL_PREVIEWED', {
    lineCount: built.length,
    totalGain: formatForPersistence(totalGain, 4),
    totalLoss: formatForPersistence(totalLoss, 4),
  })
  return serializeRun(run)
}

type JournalSourceLine = {
  sourceType: 'AR_OPEN_ITEM' | 'AP_OPEN_ITEM'
  sourceId: string
  glAccountId: string
  gainLossBase: Prisma.Decimal | string
  isAsset: boolean
  accountOrParty: string
  partyType: 'CUSTOMER' | 'VENDOR'
  partyId: string
  partyNameSnapshot: string
}

function buildJournalLines(
  lines: JournalSourceLine[],
  gainAccountId: string,
  lossAccountId: string,
  reverse: boolean,
): PostingRequestLine[] {
  const out: PostingRequestLine[] = []
  let n = 1
  for (const line of lines) {
    const gl = toDecimal(line.gainLossBase)
    if (isZero(gl)) continue
    const amount = formatForPersistence(toDecimal(gl.abs()), 4)
    const isGain = compare(gl, 0) > 0
    const narration = `FX reval ${line.accountOrParty}`.slice(0, 200)

    // Asset gain: Dr AR / Cr Gain. Asset loss: Dr Loss / Cr AR.
    // Liability gain (gainLoss>0 means liability shrunk): Dr AP / Cr Gain.
    // Liability loss: Dr Loss / Cr AP.
    const debitMonetary = isGain
    const monetaryDebit = reverse ? !debitMonetary : debitMonetary

    out.push({
      lineNumber: n++,
      accountId: line.glAccountId,
      partyType: line.partyType,
      partyId: line.partyId,
      partyNameSnapshot: line.partyNameSnapshot,
      debitAmount: monetaryDebit ? amount : ZERO,
      creditAmount: monetaryDebit ? ZERO : amount,
      lineNarration: narration,
    })
    out.push({
      lineNumber: n++,
      accountId: isGain ? gainAccountId : lossAccountId,
      debitAmount: monetaryDebit ? ZERO : amount,
      creditAmount: monetaryDebit ? amount : ZERO,
      lineNarration: narration,
    })
  }
  return out
}

async function resolveJournalSourceLines(
  tenantId: string,
  lines: Array<{
    sourceType: 'AR_OPEN_ITEM' | 'AP_OPEN_ITEM'
    sourceId: string
    glAccountId: string
    gainLossBase: Prisma.Decimal | string
    isAsset: boolean
    accountOrParty: string
  }>,
): Promise<JournalSourceLine[]> {
  const arIds = lines.filter((l) => l.sourceType === 'AR_OPEN_ITEM').map((l) => l.sourceId)
  const apIds = lines.filter((l) => l.sourceType === 'AP_OPEN_ITEM').map((l) => l.sourceId)
  const [arItems, apItems] = await Promise.all([
    arIds.length
      ? prisma.receivableOpenItem.findMany({
          where: { tenantId, id: { in: arIds } },
          select: { id: true, customerId: true, customerNameSnapshot: true },
        })
      : Promise.resolve([]),
    apIds.length
      ? prisma.payableOpenItem.findMany({
          where: { tenantId, id: { in: apIds } },
          select: { id: true, vendorId: true, vendorNameSnapshot: true },
        })
      : Promise.resolve([]),
  ])
  const arMap = new Map(arItems.map((i) => [i.id, i]))
  const apMap = new Map(apItems.map((i) => [i.id, i]))

  return lines.map((line) => {
    if (line.sourceType === 'AR_OPEN_ITEM') {
      const item = arMap.get(line.sourceId)
      if (!item) {
        throw unprocessable(`AR open item ${line.sourceId} missing for FX journal`, CODES.NO_LINES)
      }
      return {
        ...line,
        partyType: 'CUSTOMER' as const,
        partyId: item.customerId,
        partyNameSnapshot: item.customerNameSnapshot ?? line.accountOrParty,
      }
    }
    const item = apMap.get(line.sourceId)
    if (!item) {
      throw unprocessable(`AP open item ${line.sourceId} missing for FX journal`, CODES.NO_LINES)
    }
    return {
      ...line,
      partyType: 'VENDOR' as const,
      partyId: item.vendorId,
      partyNameSnapshot: item.vendorNameSnapshot,
    }
  })
}

export async function postFxRevaluation(req: Request, tenantId: string, runId: string) {
  const run = await prisma.fxRevaluationRun.findFirst({
    where: { id: runId, tenantId },
    include: runInclude,
  })
  if (!run) throw new NotFoundError('FX revaluation run not found')
  if (run.status === 'POSTED' || run.status === 'REVERSED') return serializeRun(run)
  if (run.status !== 'PREVIEWED') {
    throw unprocessable(`Run is ${run.status}; preview before posting`, CODES.NOT_PREVIEWED)
  }
  if (run.period.status !== 'OPEN' && run.period.status !== 'REOPENED') {
    throw unprocessable(`Period ${run.period.name} is ${run.period.status}`, CODES.PERIOD_NOT_OPEN)
  }
  if (run.lines.length === 0) {
    throw unprocessable('No FX differences to post', CODES.NO_LINES)
  }
  if (!run.gainAccountId || !run.lossAccountId) {
    throw unprocessable('Gain/loss accounts missing on run — re-preview', CODES.MAPPING_MISSING)
  }

  const postingDate = toIsoDate(run.asOfDate)
  const sourced = await resolveJournalSourceLines(tenantId, run.lines)
  const journalLines = buildJournalLines(sourced, run.gainAccountId, run.lossAccountId, false)
  if (journalLines.length < 2) {
    throw unprocessable('No FX differences to post', CODES.NO_LINES)
  }

  const request: PostingRequest = {
    legalEntityId: run.legalEntityId,
    eventKey: `PERIOD_FX_REVAL_POST:${run.id}:V1`,
    eventType: 'PERIOD_FX_REVALUATION_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    referenceNumber: `FXR-${run.period.name}`,
    narration: `Unrealized FX revaluation — ${run.period.name}`,
    currencyCode: run.baseCurrency,
    exchangeRate: '1',
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: run.id,
    lines: journalLines,
  }

  let result
  try {
    result = await post(request, postingContext(req, tenantId))
  } catch (error) {
    if (error instanceof PostingError) {
      throw unprocessable(`Could not post FX revaluation: ${error.message}`, CODES.POSTING_FAILED, {
        postingCode: error.code,
      })
    }
    throw error
  }

  // Update open-item base amounts + rates so AR/AP stay aligned with GL.
  await prisma.$transaction(async (tx) => {
    for (const line of run.lines) {
      if (line.sourceType === 'AR_OPEN_ITEM') {
        await tx.receivableOpenItem.updateMany({
          where: { id: line.sourceId, tenantId },
          data: {
            exchangeRate: line.closingRate,
            baseOpenAmount: line.revaluedValueBase,
          },
        })
      } else {
        await tx.payableOpenItem.updateMany({
          where: { id: line.sourceId, tenantId },
          data: {
            exchangeRate: line.closingRate,
            baseOutstandingAmount: line.revaluedValueBase,
          },
        })
      }
    }
    await tx.fxRevaluationRun.update({
      where: { id: run.id },
      data: {
        status: 'POSTED',
        voucherId: result.voucherId,
        postingEventId: result.postingEventId,
        voucherNumber: result.voucherNumber,
        postedAt: new Date(),
        postedBy: req.context?.userId ?? null,
      },
    })
  })

  await audit(req, tenantId, run.id, 'FX_REVAL_POSTED', { voucherNumber: result.voucherNumber })
  return getFxRunForPeriod(tenantId, run.periodId).then((r) => r!)
}

export async function reverseFxRevaluation(
  req: Request,
  tenantId: string,
  runId: string,
  input: ReverseFxRunInput,
) {
  const run = await prisma.fxRevaluationRun.findFirst({
    where: { id: runId, tenantId },
    include: runInclude,
  })
  if (!run) throw new NotFoundError('FX revaluation run not found')
  if (run.status === 'REVERSED') return serializeRun(run)
  if (run.status !== 'POSTED') {
    throw unprocessable(`Run is ${run.status}; only POSTED runs can be reversed`, CODES.NOT_EDITABLE)
  }
  if (!run.gainAccountId || !run.lossAccountId) {
    throw unprocessable('Gain/loss accounts missing on run', CODES.MAPPING_MISSING)
  }

  const period = await prisma.accountingPeriod.findFirstOrThrow({ where: { id: run.periodId } })
  const next = await resolveNextPeriod(tenantId, run.legalEntityId, period)
  if (!next) {
    throw unprocessable('No next accounting period for FX reversal', CODES.NEXT_PERIOD_MISSING)
  }
  if (next.status !== 'OPEN' && next.status !== 'REOPENED') {
    throw unprocessable(`Reversal period ${next.name} is ${next.status}`, CODES.PERIOD_NOT_OPEN)
  }

  const reversalDate = input.reversalDate ?? toIsoDate(next.startDate)
  const sourced = await resolveJournalSourceLines(tenantId, run.lines)
  const journalLines = buildJournalLines(sourced, run.gainAccountId, run.lossAccountId, true)

  const request: PostingRequest = {
    legalEntityId: run.legalEntityId,
    eventKey: `PERIOD_FX_REVAL_REVERSE:${run.id}:V1`,
    eventType: 'PERIOD_FX_REVALUATION_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: reversalDate,
    postingDate: reversalDate,
    referenceNumber: run.voucherNumber,
    narration: `Reversal of FX revaluation ${run.voucherNumber ?? run.id}: ${input.reason}`.slice(0, 500),
    currencyCode: run.baseCurrency,
    exchangeRate: '1',
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: run.id,
    lines: journalLines,
  }

  let result
  try {
    result = await post(request, postingContext(req, tenantId))
  } catch (error) {
    if (error instanceof PostingError) {
      throw unprocessable(`Could not reverse FX revaluation: ${error.message}`, CODES.POSTING_FAILED, {
        postingCode: error.code,
      })
    }
    throw error
  }

  await prisma.fxRevaluationRun.update({
    where: { id: run.id },
    data: {
      status: 'REVERSED',
      reversalPeriodId: next.id,
      reversalVoucherId: result.voucherId,
      reversalPostingEventId: result.postingEventId,
      reversalVoucherNumber: result.voucherNumber,
      reversedAt: new Date(),
      reversedBy: req.context?.userId ?? null,
    },
  })
  await audit(req, tenantId, run.id, 'FX_REVAL_REVERSED', { reason: input.reason })
  return getFxRunForPeriod(tenantId, run.periodId).then((r) => r!)
}
