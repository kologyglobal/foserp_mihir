import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { InventorySetupBody } from './setup.schemas.js'

export const DEFAULT_INVENTORY_SETTINGS = {
  general: {
    defaultWarehouseId: null as string | null,
    defaultReceiptLocationId: null as string | null,
    defaultIssueLocationId: null as string | null,
    defaultCostingMethod: 'standard' as const,
    allowNegativeStock: false,
    requirePostingDate: true,
    requireSourceDocument: true,
    quickModeDefault: true,
    detailedModeEnabled: true,
    inventoryValueVisible: true,
  },
  tracking: {
    batchTrackingEnabled: true,
    serialTrackingEnabled: false,
    expiryTrackingEnabled: true,
    automaticBatchSelection: true,
    batchSelectionMethod: 'fefo' as const,
    expiryWarningDays: 30,
    serialUniquenessRequired: true,
  },
  quality: {
    qualityInspectionEnabled: true,
    qualityHoldLocationId: null as string | null,
    quarantineLocationId: null as string | null,
    rejectedLocationId: null as string | null,
    deviationApprovalRequired: true,
  },
  planning: {
    reorderPlanningEnabled: true,
    defaultSafetyStock: 0,
    defaultLeadTimeDays: 7,
    suggestedQuantityMethod: 'max_minus_projected' as const,
    createDraftRequirementOnly: true,
  },
  approvals: {
    adjustmentApprovalLimit: 10_000,
    negativeStockOverrideApproval: true,
    highValueTransferApproval: 50_000,
    stockCountVarianceLimit: 500,
    qualityDeviationApproval: true,
  },
  advancedWarehouse: {
    binManagement: false,
    barcodeScanning: true,
    putAway: false,
    pickList: false,
    packing: false,
    wavePicking: false,
    mobileWarehouse: false,
    consignmentInventory: false,
  },
  numberSeries: {
    receipt: { prefix: 'GRN', nextNumber: 1001, padding: 5 },
    issue: { prefix: 'MI', nextNumber: 2001, padding: 5 },
    transfer: { prefix: 'TRF', nextNumber: 3001, padding: 5 },
    adjustment: { prefix: 'ADJ', nextNumber: 4001, padding: 5 },
    stockCount: { prefix: 'SC', nextNumber: 5001, padding: 5 },
  },
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = out[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out as T
}

export async function getInventorySetup(tenantId: string) {
  const row = await prisma.inventorySettings.findUnique({ where: { tenantId } })
  if (!row) {
    return {
      ...DEFAULT_INVENTORY_SETTINGS,
      version: 1,
      updatedAt: null as string | null,
    }
  }
  return {
    ...deepMerge(
      DEFAULT_INVENTORY_SETTINGS as unknown as Record<string, unknown>,
      asObject(row.settings),
    ),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function upsertInventorySetup(
  tenantId: string,
  userId: string,
  body: InventorySetupBody,
) {
  const current = await getInventorySetup(tenantId)
  const { version: _v, updatedAt: _u, ...currentSettings } = current as Record<string, unknown> & {
    version?: number
    updatedAt?: string | null
  }
  const next = deepMerge(currentSettings, body as Record<string, unknown>)

  const row = await prisma.inventorySettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      settings: next as Prisma.InputJsonValue,
      createdById: userId,
      updatedById: userId,
    },
    update: {
      settings: next as Prisma.InputJsonValue,
      version: { increment: 1 },
      updatedById: userId,
    },
  })

  return {
    ...deepMerge(
      DEFAULT_INVENTORY_SETTINGS as unknown as Record<string, unknown>,
      asObject(row.settings),
    ),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  }
}
