import type { GrnLineToleranceStatus, GrnLineWeightToleranceStatus, GrnReceiptApprovalReason } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { QtyInput } from './purchase-quantity-decimal.js'

export type { QtyInput }

export type ResolvedReceivingTolerance = {
  source: 'MASTER' | 'SETUP' | 'SYSTEM'
  receivingToleranceId: string | null
  code: string
  name: string
  percentage: Prisma.Decimal
}

export type ReceiptLineEvaluationInput = {
  openUnitQuantity: QtyInput
  receivedUnitQuantity: QtyInput
  receivedWeight?: QtyInput | null
  standardWeightPerBaseUnit?: QtyInput | null
  receiptEntryMode?: 'UNIT_ONLY' | 'WEIGHT_ONLY' | 'UNIT_AND_WEIGHT'
  receivingToleranceId?: string | null
  receivingTolerancePercentage?: QtyInput | null
  masterTolerance?: { id: string; code: string; name: string; percentage: QtyInput } | null
  weightReceivingToleranceId?: string | null
  weightMasterTolerance?: { id: string; code: string; name: string; percentage: QtyInput } | null
  setupTolerancePct?: QtyInput | null
  allowOverReceipt?: boolean
  shortCloseRequested?: boolean
  shortCloseReason?: string | null
  manualUnitEntry?: boolean
  manualWeightEntry?: boolean
  weightUomCode?: string | null
}

export type ReceiptLineEvaluationResult = {
  tolerancePercentage: Prisma.Decimal
  receivingToleranceIdSnapshot: string | null
  receivingToleranceCodeSnapshot: string
  receivingToleranceNameSnapshot: string
  receivingTolerancePercentageSnapshot: Prisma.Decimal
  weightTolerancePercentage: Prisma.Decimal
  weightReceivingToleranceIdSnapshot: string | null
  weightReceivingToleranceCodeSnapshot: string
  weightReceivingToleranceNameSnapshot: string
  weightReceivingTolerancePercentageSnapshot: Prisma.Decimal
  maximumAllowedUnitQuantity: Prisma.Decimal
  unitVariance: Prisma.Decimal
  variancePercentage: Prisma.Decimal | null
  unitToleranceStatus: GrnLineToleranceStatus
  receivedWeight: Prisma.Decimal | null
  expectedWeight: Prisma.Decimal | null
  maximumAllowedWeight: Prisma.Decimal | null
  weightVariance: Prisma.Decimal | null
  weightVariancePercentage: Prisma.Decimal | null
  weightConversionRateSnapshot: Prisma.Decimal | null
  weightUomCodeSnapshot: string
  weightToleranceStatus: GrnLineWeightToleranceStatus
  manualUnitEntry: boolean
  manualWeightEntry: boolean
  requiresApproval: boolean
  approvalReasons: GrnReceiptApprovalReason[]
  shortCloseRequested: boolean
  shortCloseReason: string | null
  shortQuantity: Prisma.Decimal
  excessQuantity: Prisma.Decimal
}
