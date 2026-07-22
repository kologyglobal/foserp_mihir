import type { Prisma, ProductionDowntimeScope, ProductionIssueType } from '@prisma/client'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'

type DbClient = Prisma.TransactionClient

export interface StartDowntimeInput {
  tenantId: string
  productionOrderId: string
  stageId?: string | null
  operationId?: string | null
  assignmentId?: string | null
  issueId?: string | null
  workCentreId?: string | null
  machineId?: string | null
  scope?: ProductionDowntimeScope
  reasonType?: ProductionIssueType | null
  reasonLabel?: string | null
  startedBy?: string | null
  notes?: string | null
}

export async function findOpenAssignmentDowntime(client: DbClient, tenantId: string, assignmentId: string) {
  return client.productionDowntime.findFirst({
    where: { tenantId, assignmentId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })
}

export async function startDowntime(client: DbClient, input: StartDowntimeInput) {
  if (input.assignmentId) {
    const open = await findOpenAssignmentDowntime(client, input.tenantId, input.assignmentId)
    if (open) throw new ConflictError('An open downtime already exists for this assignment')
  }

  const now = new Date()
  const downtime = await client.productionDowntime.create({
    data: {
      tenantId: input.tenantId,
      productionOrderId: input.productionOrderId,
      stageId: input.stageId ?? null,
      operationId: input.operationId ?? null,
      assignmentId: input.assignmentId ?? null,
      issueId: input.issueId ?? null,
      workCentreId: input.workCentreId ?? null,
      machineId: input.machineId ?? null,
      scope: input.scope ?? 'TASK',
      reasonType: input.reasonType ?? null,
      reasonLabel: input.reasonLabel ?? null,
      startedAt: now,
      startedBy: input.startedBy ?? null,
      notes: input.notes ?? null,
    },
  })

  await logProductionActivity(
    {
      tenantId: input.tenantId,
      productionOrderId: input.productionOrderId,
      activityType: 'DOWNTIME_STARTED',
      userId: input.startedBy,
      message: input.reasonLabel ?? `Downtime started (${input.scope ?? 'TASK'})`,
      sourceTransactionId: downtime.id,
    },
    client,
  )

  return downtime
}

export async function endDowntime(client: DbClient, tenantId: string, downtimeId: string, endedBy?: string | null) {
  const downtime = await client.productionDowntime.findFirst({ where: { id: downtimeId, tenantId } })
  if (!downtime) throw new NotFoundError('Downtime not found')
  if (downtime.endedAt) return downtime

  const endedAt = new Date()
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - downtime.startedAt.getTime()) / 60_000))

  const updated = await client.productionDowntime.update({
    where: { id: downtimeId },
    data: { endedAt, endedBy: endedBy ?? null, durationMinutes },
  })

  if (downtime.stageId) {
    await client.productionOrderStage.update({
      where: { id: downtime.stageId },
      data: { totalDowntimeMinutes: { increment: durationMinutes } },
    })
  }

  await logProductionActivity(
    {
      tenantId,
      productionOrderId: downtime.productionOrderId,
      activityType: 'DOWNTIME_ENDED',
      userId: endedBy,
      message: `Downtime ended (${durationMinutes} min)`,
      sourceTransactionId: downtime.id,
    },
    client,
  )

  return updated
}

export async function endOpenAssignmentDowntime(
  client: DbClient,
  tenantId: string,
  assignmentId: string,
  endedBy?: string | null,
) {
  const open = await findOpenAssignmentDowntime(client, tenantId, assignmentId)
  if (!open) return null
  return endDowntime(client, tenantId, open.id, endedBy)
}
