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
  PURCHASE_PLANNING: 'PPS',
  REQUEST_FOR_QUOTATION: 'RFQ',
  VENDOR_QUOTATION: 'VQ',
  VENDOR_COMPARISON: 'CMP',
  PURCHASE_ORDER: 'PO',
  GOODS_RECEIPT: 'GRN',
  QUALITY_INSPECTION: 'QI',
  PURCHASE_QUALITY_INSPECTION: 'PQI',
  QUALITY_NCR: 'NCR',
  PURCHASE_INVOICE: 'PI',
  PURCHASE_RETURN: 'PRT',
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
  DISPATCH_POSTING: 'DPO',
  DISPATCH_REVERSAL: 'DRV',
  INVENTORY_TRANSFER: 'ITR',
  INVENTORY_STOCK_COUNT: 'STC',
  INVENTORY_ADJUSTMENT: 'IADJ',
  MANUFACTURING_ROUTING: 'RT',
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

/** Non-consuming peek at the next document number (does not increment). */
export async function previewNextCode(
  tenantId: string,
  entityType: CodeSeriesEntity,
): Promise<string> {
  await ensureCodeSeries(tenantId, entityType)
  const series = await prisma.codeSeries.findUnique({
    where: { tenantId_entityType: { tenantId, entityType } },
  })
  if (!series) {
    const prefix = DEFAULT_PREFIX[entityType]
    return `${prefix}-${String(1).padStart(6, '0')}`
  }
  const next = series.currentValue + 1
  return `${series.prefix}-${String(next).padStart(series.padLength, '0')}`
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
    'PRODUCTION_DEMAND',
    'PRODUCTION_ORDER',
    'DAILY_PRODUCTION_BATCH',
    'PRODUCTION_ISSUE',
    'STOCK_MOVEMENT',
    'STOCK_RESERVATION',
    'PURCHASE_REQUISITION',
    'PURCHASE_PLANNING',
    'REQUEST_FOR_QUOTATION',
    'VENDOR_QUOTATION',
    'VENDOR_COMPARISON',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'QUALITY_INSPECTION',
    'QUALITY_NCR',
    'PURCHASE_INVOICE',
    'PURCHASE_RETURN',
    'JOB_WORK_ORDER',
    'PRODUCTION_RUNTIME_CHANGE',
    'PRODUCTION_WIP_MOVEMENT',
    'MANUFACTURING_CORRECTION',
    'PRODUCTION_PLAN',
    'DEMAND_CONSOLIDATION_PLAN',
    'OUTBOUND_DISPATCH',
    'PRODUCTION_FG_RECEIPT',
    'DISPATCH_REQUIREMENT',
    'DISPATCH_PICK_LIST',
    'DISPATCH_PACKING_SESSION',
    'DISPATCH_PACKAGE',
    'DELIVERY_CHALLAN',
    'DISPATCH_POSTING',
    'DISPATCH_REVERSAL',
    'INVENTORY_TRANSFER',
    'INVENTORY_STOCK_COUNT',
    'INVENTORY_ADJUSTMENT',
    'MANUFACTURING_ROUTING',
  ]
  for (const entityType of types) {
    await ensureCodeSeries(tenantId, entityType, tx)
  }
}
