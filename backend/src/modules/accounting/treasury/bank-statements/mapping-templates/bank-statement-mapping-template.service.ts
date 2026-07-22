import type { Request } from 'express'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { auditMappingTemplateAction } from '../bank-statement-audit.service.js'
import * as repo from './bank-statement-mapping-template.repository.js'
import type {
  CreateMappingTemplateInput,
  ListMappingTemplatesQuery,
  UpdateMappingTemplateInput,
} from './bank-statement-mapping-template.schemas.js'

export async function listMappingTemplates(tenantId: string, query: ListMappingTemplatesQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  return repo.listTemplates(tenantId, query)
}

export async function getMappingTemplate(tenantId: string, id: string) {
  return repo.getTemplateOrThrow(tenantId, id)
}

export async function createMappingTemplate(req: Request, tenantId: string, input: CreateMappingTemplateInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const item = await repo.createTemplate(tenantId, {
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId ?? null,
    bankNameKey: input.bankNameKey ?? null,
    name: input.name,
    importFormat: input.importFormat,
    isDefault: input.isDefault,
    sheetNamePattern: input.sheetNamePattern ?? null,
    headerRowNumber: input.headerRowNumber ?? null,
    dataStartRowNumber: input.dataStartRowNumber ?? null,
    delimiter: input.delimiter ?? null,
    encoding: input.encoding ?? null,
    mappingConfig: input.mappingConfig,
    parsingConfig: input.parsingConfig,
    createdById: req.context?.userId ?? null,
  })
  await auditMappingTemplateAction(req, 'Create', item.id, null, { name: item.name })
  return item
}

export async function updateMappingTemplate(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateMappingTemplateInput,
) {
  const existing = await repo.getTemplateOrThrow(tenantId, id)
  const { expectedUpdatedAt, ...rest } = input
  const item = await repo.updateTemplate(
    tenantId,
    id,
    {
      ...rest,
      bankNameKey: rest.bankNameKey?.trim().toUpperCase(),
      mappingConfig: rest.mappingConfig,
      parsingConfig: rest.parsingConfig,
      updatedById: req.context?.userId ?? null,
    },
    expectedUpdatedAt,
  )
  await auditMappingTemplateAction(req, 'Update', id, existing, item)
  return item
}

export async function activateMappingTemplate(
  req: Request,
  tenantId: string,
  id: string,
  expectedUpdatedAt: string,
) {
  const item = await repo.setTemplateActive(tenantId, id, true, expectedUpdatedAt)
  await auditMappingTemplateAction(req, 'Activate', id, null, { isActive: true })
  return item
}

export async function deactivateMappingTemplate(
  req: Request,
  tenantId: string,
  id: string,
  expectedUpdatedAt: string,
) {
  const item = await repo.setTemplateActive(tenantId, id, false, expectedUpdatedAt)
  await auditMappingTemplateAction(req, 'Deactivate', id, null, { isActive: false })
  return item
}
