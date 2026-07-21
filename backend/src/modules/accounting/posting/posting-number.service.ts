import type { AccountingVoucherType, FinanceDocumentType, PostingEvent } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { VoucherType } from '../ledger/ledger.types.js'
import { PostingError } from './posting.errors.js'
import * as postingEventRepo from '../ledger/posting-event.repository.js'

export interface ReservedVoucherNumber {
  numberSeriesId: string
  voucherNumber: string
  reused: boolean
}

const VOUCHER_TO_DOCUMENT: Record<AccountingVoucherType, FinanceDocumentType | null> = {
  JOURNAL: 'JOURNAL',
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  CONTRA: 'CONTRA',
  DEBIT_NOTE: 'DEBIT_NOTE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  OPENING_BALANCE: 'OPENING_BALANCE',
  REVERSAL: 'REVERSAL',
  SYSTEM: 'JOURNAL',
}

export function mapVoucherTypeToDocumentType(voucherType: VoucherType): FinanceDocumentType {
  const mapped = VOUCHER_TO_DOCUMENT[voucherType as AccountingVoucherType]
  if (!mapped) {
    throw new PostingError('NUMBER_SERIES_NOT_CONFIGURED', `No number series mapping for voucher type ${voucherType}`)
  }
  if (voucherType === 'SYSTEM' && mapped !== 'JOURNAL') {
    throw new PostingError('NUMBER_SERIES_NOT_CONFIGURED', 'SYSTEM vouchers require JOURNAL number series')
  }
  return mapped
}

export async function reserveVoucherNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  voucherType: VoucherType,
  event: PostingEvent,
): Promise<ReservedVoucherNumber> {
  if (event.reservedVoucherNumber && event.numberSeriesId) {
    return {
      numberSeriesId: event.numberSeriesId,
      voucherNumber: event.reservedVoucherNumber,
      reused: true,
    }
  }

  const documentType = mapVoucherTypeToDocumentType(voucherType)

  const reservation = await prisma.$transaction(async (tx) => {
    const series = await tx.financeNumberSeries.findFirst({
      where: {
        tenantId,
        legalEntityId,
        documentType,
        isActive: true,
        OR: [{ financialYearId }, { financialYearId: null }],
      },
      orderBy: [{ financialYearId: 'desc' }, { updatedAt: 'desc' }],
    })

    if (!series) {
      throw new PostingError('NUMBER_SERIES_NOT_CONFIGURED', `Number series not configured for ${documentType}`)
    }
    if (!series.isActive) {
      throw new PostingError('NUMBER_SERIES_INACTIVE', `Number series for ${documentType} is inactive`)
    }

    await tx.financeNumberSeries.update({
      where: { id: series.id },
      data: { currentValue: { increment: 1 } },
    })

    const updated = await tx.financeNumberSeries.findUniqueOrThrow({ where: { id: series.id } })
    const padded = String(updated.currentValue).padStart(updated.padLength, '0')
    const voucherNumber = `${updated.prefix}${padded}`

    return {
      numberSeriesId: updated.id,
      voucherNumber,
      reused: false,
    }
  })

  await postingEventRepo.saveNumberReservation(tenantId, event.id, {
    numberSeriesId: reservation.numberSeriesId,
    reservedVoucherNumber: reservation.voucherNumber,
  })

  return reservation
}

export interface ReservedSourceDocumentNumber {
  numberSeriesId: string
  documentNumber: string
  reused: boolean
}

export async function reserveSourceDocumentNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  documentType: 'SALES_INVOICE' | 'CUSTOMER_RECEIPT' | 'CUSTOMER_CREDIT_NOTE',
  event: PostingEvent,
): Promise<ReservedSourceDocumentNumber> {
  if (event.reservedSourceDocumentNumber && event.sourceNumberSeriesId) {
    return {
      numberSeriesId: event.sourceNumberSeriesId,
      documentNumber: event.reservedSourceDocumentNumber,
      reused: true,
    }
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const series = await tx.financeNumberSeries.findFirst({
      where: {
        tenantId,
        legalEntityId,
        documentType,
        isActive: true,
        OR: [{ financialYearId }, { financialYearId: null }],
      },
      orderBy: [{ financialYearId: 'desc' }, { updatedAt: 'desc' }],
    })

    if (!series) {
      throw new PostingError('NUMBER_SERIES_NOT_CONFIGURED', `Number series not configured for ${documentType}`)
    }
    if (!series.isActive) {
      throw new PostingError('NUMBER_SERIES_INACTIVE', `Number series for ${documentType} is inactive`)
    }

    await tx.financeNumberSeries.update({
      where: { id: series.id },
      data: { currentValue: { increment: 1 } },
    })

    const updated = await tx.financeNumberSeries.findUniqueOrThrow({ where: { id: series.id } })
    const padded = String(updated.currentValue).padStart(updated.padLength, '0')
    const documentNumber = `${updated.prefix}${padded}`

    return {
      numberSeriesId: updated.id,
      documentNumber,
      reused: false,
    }
  })

  await postingEventRepo.saveSourceNumberReservation(tenantId, event.id, {
    sourceNumberSeriesId: reservation.numberSeriesId,
    reservedSourceDocumentNumber: reservation.documentNumber,
  })

  return reservation
}
