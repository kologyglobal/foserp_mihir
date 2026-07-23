import type { PeriodCloseChecklistAckStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ValidationError } from '../../../utils/errors.js'
import { getPeriod } from './accounting-period.repository.js'

const ALLOWED_KEYS = new Set([
  'PERIOD_STATUS',
  'AP_CLOSE_GATE',
  'UNPOSTED_JOURNALS',
  'BANK_RECON',
  'INVENTORY_GL',
  'MFG_GL',
])

export interface ChecklistAckDto {
  id: string
  periodId: string
  checkKey: string
  status: PeriodCloseChecklistAckStatus
  note: string | null
  ackedBy: string | null
  ackedAt: string
  updatedAt: string
}

export interface UpsertChecklistAckItem {
  checkKey: string
  status: 'ACK' | 'NA'
  note?: string | null
}

function toDto(row: {
  id: string
  periodId: string
  checkKey: string
  status: PeriodCloseChecklistAckStatus
  note: string | null
  ackedBy: string | null
  ackedAt: Date
  updatedAt: Date
}): ChecklistAckDto {
  return {
    id: row.id,
    periodId: row.periodId,
    checkKey: row.checkKey,
    status: row.status,
    note: row.note,
    ackedBy: row.ackedBy,
    ackedAt: row.ackedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listChecklistAcks(tenantId: string, periodId: string): Promise<ChecklistAckDto[]> {
  await getPeriod(tenantId, periodId)
  const rows = await prisma.periodCloseChecklistAck.findMany({
    where: { tenantId, periodId },
    orderBy: { checkKey: 'asc' },
  })
  return rows.map(toDto)
}

export async function upsertChecklistAcks(
  tenantId: string,
  periodId: string,
  userId: string,
  items: UpsertChecklistAckItem[],
): Promise<ChecklistAckDto[]> {
  await getPeriod(tenantId, periodId)
  if (!items.length) throw new ValidationError('At least one checklist ack item is required')

  for (const item of items) {
    if (!ALLOWED_KEYS.has(item.checkKey)) {
      throw new ValidationError(`Invalid checkKey: ${item.checkKey}`)
    }
    if (item.status === 'NA' && !item.note?.trim()) {
      throw new ValidationError(`N/A for ${item.checkKey} requires a note`)
    }
  }

  const now = new Date()
  await prisma.$transaction(
    items.map((item) =>
      prisma.periodCloseChecklistAck.upsert({
        where: { periodId_checkKey: { periodId, checkKey: item.checkKey } },
        create: {
          tenantId,
          periodId,
          checkKey: item.checkKey,
          status: item.status,
          note: item.note?.trim() || null,
          ackedBy: userId,
          ackedAt: now,
        },
        update: {
          status: item.status,
          note: item.note?.trim() || null,
          ackedBy: userId,
          ackedAt: now,
        },
      }),
    ),
  )

  return listChecklistAcks(tenantId, periodId)
}
