import type { PipelineStatus, Prisma } from '@prisma/client'
import { DEFAULT_PIPELINE_STAGES } from '../../../constants/permissions.js'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { CreatePipelineInput, ListPipelinesQuery, StageInput, UpdatePipelineInput } from './pipeline.validation.js'

const stageInclude = {
  stages: { where: { deletedAt: null }, orderBy: { sequence: 'asc' as const } },
}

export async function findPipelines(tenantId: string, query: ListPipelinesQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmPipelineWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as PipelineStatus } : {}),
    ...(query.isDefault !== undefined ? { isDefault: query.isDefault } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }] }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmPipeline.findMany({ where, skip, take, include: stageInclude, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmPipeline.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findPipelineById(tenantId: string, id: string) {
  return prisma.crmPipeline.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: stageInclude,
  })
}

export async function createPipeline(tenantId: string, userId: string, data: CreatePipelineInput) {
  const stages = data.stages ?? DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s }))
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.crmPipeline.updateMany({
        where: { tenantId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      })
    }

    const pipeline = await tx.crmPipeline.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false,
        status: (data.status as PipelineStatus | undefined) ?? 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await createStages(tx, tenantId, pipeline.id, userId, stages)
    return tx.crmPipeline.findUniqueOrThrow({ where: { id: pipeline.id }, include: stageInclude })
  })
}

export async function updatePipeline(tenantId: string, id: string, userId: string, data: UpdatePipelineInput) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.crmPipeline.updateMany({
        where: { tenantId, deletedAt: null, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    await tx.crmPipeline.update({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.status !== undefined ? { status: data.status as PipelineStatus } : {}),
        updatedBy: userId,
      },
    })

    if (data.stages) {
      await tx.crmPipelineStage.updateMany({
        where: { pipelineId: id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: userId },
      })
      await createStages(tx, tenantId, id, userId, data.stages)
    }

    return tx.crmPipeline.findUniqueOrThrow({ where: { id }, include: stageInclude })
  })
}

async function createStages(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pipelineId: string,
  userId: string,
  stages: StageInput[],
) {
  for (const [index, stage] of stages.entries()) {
    await tx.crmPipelineStage.create({
      data: {
        tenantId,
        pipelineId,
        name: stage.name,
        slug: stage.slug,
        sequence: stage.sequence ?? index + 1,
        probability: stage.probability ?? 0,
        isClosedWon: stage.isClosedWon ?? false,
        isClosedLost: stage.isClosedLost ?? false,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  }
}

export async function softDeletePipeline(tenantId: string, id: string, userId: string) {
  return prisma.crmPipeline.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, status: 'ARCHIVED' },
  })
}

export async function findStageBySlug(tenantId: string, pipelineId: string, slug: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { tenantId, pipelineId, slug, deletedAt: null },
  })
}

export async function findWonStage(tenantId: string, pipelineId: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { tenantId, pipelineId, isClosedWon: true, deletedAt: null },
  })
}

export async function findLostStage(tenantId: string, pipelineId: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { tenantId, pipelineId, isClosedLost: true, deletedAt: null },
  })
}
