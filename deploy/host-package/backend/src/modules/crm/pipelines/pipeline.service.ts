import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './pipeline.repository.js'
import { mapPipelineToDto } from './pipeline.types.js'
import type { CreatePipelineInput, ListPipelinesQuery, UpdatePipelineInput } from './pipeline.validation.js'

export async function listPipelines(tenantId: string, query: ListPipelinesQuery) {
  const result = await repo.findPipelines(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((p) => [p.createdBy, p.updatedBy]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((p) =>
      mapPipelineToDto(p, {
        createdByName: p.createdBy ? nameMap.get(p.createdBy) : undefined,
        modifiedByName: p.updatedBy ? nameMap.get(p.updatedBy) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getPipeline(tenantId: string, id: string) {
  const pipeline = await repo.findPipelineById(tenantId, id)
  if (!pipeline) throw new NotFoundError('Pipeline not found')
  const nameMap = await resolveUserNames([pipeline.createdBy, pipeline.updatedBy], tenantId, prisma)
  return mapPipelineToDto(pipeline, {
    createdByName: pipeline.createdBy ? nameMap.get(pipeline.createdBy) : undefined,
    modifiedByName: pipeline.updatedBy ? nameMap.get(pipeline.updatedBy) : undefined,
  })
}

export async function createPipeline(tenantId: string, userId: string, input: CreatePipelineInput) {
  const pipeline = await repo.createPipeline(tenantId, userId, input)
  return mapPipelineToDto(pipeline)
}

export async function updatePipeline(tenantId: string, id: string, userId: string, input: UpdatePipelineInput) {
  const existing = await repo.findPipelineById(tenantId, id)
  if (!existing) throw new NotFoundError('Pipeline not found')
  const pipeline = await repo.updatePipeline(tenantId, id, userId, input)
  return mapPipelineToDto(pipeline)
}

export async function deletePipeline(tenantId: string, id: string, userId: string) {
  const existing = await repo.findPipelineById(tenantId, id)
  if (!existing) throw new NotFoundError('Pipeline not found')
  await repo.softDeletePipeline(tenantId, id, userId)
}
