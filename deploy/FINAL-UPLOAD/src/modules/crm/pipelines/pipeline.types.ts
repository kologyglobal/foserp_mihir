import type { CrmPipeline, CrmPipelineStage } from '@prisma/client'
import { mapAuditFields, type AuditUserNames } from '../../../shared/index.js'

export interface PipelineStageDto {
  id: string
  pipelineId: string
  name: string
  slug: string
  sequence: number
  probability: number
  isClosedWon: boolean
  isClosedLost: boolean
}

export interface PipelineDto {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  status: string
  stages: PipelineStageDto[]
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export function mapStageToDto(stage: CrmPipelineStage): PipelineStageDto {
  return {
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    slug: stage.slug,
    sequence: stage.sequence,
    probability: stage.probability,
    isClosedWon: stage.isClosedWon,
    isClosedLost: stage.isClosedLost,
  }
}

export function mapPipelineToDto(
  pipeline: CrmPipeline & { stages?: CrmPipelineStage[] },
  names?: AuditUserNames,
): PipelineDto {
  return {
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    isDefault: pipeline.isDefault,
    status: pipeline.status.toLowerCase(),
    stages: (pipeline.stages ?? []).filter((s) => !s.deletedAt).map(mapStageToDto),
    ...mapAuditFields(pipeline, names),
  }
}
