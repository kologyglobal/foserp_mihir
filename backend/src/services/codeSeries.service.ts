import type { CodeSeriesEntity, Prisma } from '@prisma/client'
import { prisma } from '../config/database.js'

const DEFAULT_PREFIX: Record<CodeSeriesEntity, string> = {
  USER: 'USR',
  LEAD: 'LEAD',
  CONTACT: 'CON',
  CRM_COMPANY: 'CRMCO',
  OPPORTUNITY: 'OPP',
  QUOTATION: 'QUO',
  SALES_ORDER: 'SO',
  PRODUCTION_DEMAND: 'PD',
  PRODUCTION_ORDER: 'WO',
  DAILY_PRODUCTION_BATCH: 'DP',
  PRODUCTION_ISSUE: 'PI',
  STOCK_MOVEMENT: 'STM',
  STOCK_RESERVATION: 'RES',
  PURCHASE_REQUISITION: 'PR',
  QUALITY_INSPECTION: 'QI',
  QUALITY_NCR: 'NCR',
  JOB_WORK_ORDER: 'JW',
  PRODUCTION_RUNTIME_CHANGE: 'RC',
  PRODUCTION_WIP_MOVEMENT: 'WM',
  MANUFACTURING_CORRECTION: 'MC',
  PRODUCTION_PLAN: 'PP',
  DEMAND_CONSOLIDATION_PLAN: 'PP',
  OUTBOUND_DISPATCH: 'DSP',
  PRODUCTION_FG_RECEIPT: 'FG',
  DISPATCH_REQUIREMENT: 'DRQ',
  DISPATCH_PICK_LIST: 'PKL',
  DISPATCH_PACKING_SESSION: 'DPS',
  DISPATCH_PACKAGE: 'PKG',
  DELIVERY_CHALLAN: 'DC',
}

export async function ensureCodeSeries(
  tenantId: string,
  entityType: CodeSeriesEntity,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma
  await client.codeSeries.upsert({
    where: { tenantId_entityType: { tenantId, entityType } },
    create: {
      tenantId,
      entityType,
      prefix: DEFAULT_PREFIX[entityType],
      currentValue: 0,
      padLength: 6,
    },
    update: {},
  })
}

async function generateNextCode(
  db: Prisma.TransactionClient,
  tenantId: string,
  entityType: CodeSeriesEntity,
): Promise<string> {
  await ensureCodeSeries(tenantId, entityType, db)
  const series = await db.codeSeries.update({
    where: { tenantId_entityType: { tenantId, entityType } },
    data: { currentValue: { increment: 1 } },
  })
  const num = String(series.currentValue).padStart(series.padLength, '0')
  return `${series.prefix}-${num}`
}

export async function nextCode(
  tenantId: string,
  entityType: CodeSeriesEntity,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  if (tx) {
    return generateNextCode(tx, tenantId, entityType)
  }
  return prisma.$transaction((innerTx) => generateNextCode(innerTx, tenantId, entityType))
}

export async function initTenantCodeSeries(tenantId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const types: CodeSeriesEntity[] = [
    'USER',
    'LEAD',
    'CONTACT',
    'CRM_COMPANY',
    'OPPORTUNITY',
    'QUOTATION',
    'SALES_ORDER',
  ]
  for (const entityType of types) {
    await ensureCodeSeries(tenantId, entityType, tx)
  }
}
