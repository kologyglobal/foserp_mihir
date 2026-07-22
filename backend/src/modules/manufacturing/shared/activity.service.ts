import type { Prisma, ProductionActivityType } from '@prisma/client'
import { prisma } from '../../../config/database.js'

export interface LogProductionActivityInput {
  tenantId: string
  productionOrderId: string
  activityType: ProductionActivityType
  userId?: string | null
  message: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  sourceTransactionId?: string | null
  metadata?: unknown
}

export async function logProductionActivity(
  input: LogProductionActivityInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma
  await client.productionActivity.create({
    data: {
      tenantId: input.tenantId,
      productionOrderId: input.productionOrderId,
      activityType: input.activityType,
      userId: input.userId ?? null,
      message: input.message,
      oldValue: (input.oldValue ?? undefined) as Prisma.InputJsonValue,
      newValue: (input.newValue ?? undefined) as Prisma.InputJsonValue,
      reason: input.reason ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
    },
  })
}
