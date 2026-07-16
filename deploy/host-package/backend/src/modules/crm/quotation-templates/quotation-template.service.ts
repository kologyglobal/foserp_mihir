import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './quotation-template.repository.js'
import { mapQuotationTemplateToDto } from './quotation-template.types.js'
import type {
  CreateQuotationTemplateInput,
  DuplicateQuotationTemplateInput,
  ListQuotationTemplatesQuery,
  UpdateQuotationTemplateInput,
} from './quotation-template.validation.js'

async function mapWithNames(tenantId: string, row: NonNullable<Awaited<ReturnType<typeof repo.findQuotationTemplateById>>>) {
  const nameMap = await resolveUserNames([row.createdBy, row.updatedBy], tenantId, prisma)
  return mapQuotationTemplateToDto(row, {
    createdByName: row.createdBy ? nameMap.get(row.createdBy) : undefined,
    modifiedByName: row.updatedBy ? nameMap.get(row.updatedBy) : undefined,
  })
}

export async function listQuotationTemplates(tenantId: string, query: ListQuotationTemplatesQuery) {
  const result = await repo.findQuotationTemplates(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((r) => [r.createdBy, r.updatedBy]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((row) =>
      mapQuotationTemplateToDto(row, {
        createdByName: row.createdBy ? nameMap.get(row.createdBy) : undefined,
        modifiedByName: row.updatedBy ? nameMap.get(row.updatedBy) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getQuotationTemplate(tenantId: string, id: string) {
  const row = await repo.findQuotationTemplateById(tenantId, id)
  if (!row) throw new NotFoundError('Quotation template not found')
  return mapWithNames(tenantId, row)
}

export async function createQuotationTemplate(tenantId: string, userId: string, input: CreateQuotationTemplateInput) {
  let sections: unknown[] = input.sections ?? []
  let defaultTerms = input.defaultTerms ?? ''
  let defaultWarranty = input.defaultWarranty ?? ''
  let defaultExclusions = input.defaultExclusions ?? ''
  let printLayout: unknown | null = input.printLayout ?? null
  let productFamily = input.productFamily || 'Custom'
  let version = input.version ?? 1

  if (input.sourceTemplateId) {
    const source = await repo.findQuotationTemplateById(tenantId, input.sourceTemplateId)
    if (!source) throw new ValidationError('Source template not found')
    sections = Array.isArray(source.sections) ? (source.sections as unknown[]) : []
    defaultTerms = input.defaultTerms ?? source.defaultTerms
    defaultWarranty = input.defaultWarranty ?? source.defaultWarranty
    defaultExclusions = input.defaultExclusions ?? source.defaultExclusions
    printLayout = input.printLayout !== undefined ? input.printLayout : source.printLayout
    productFamily = input.productFamily || source.productFamily
    version = 1
  }

  const row = await repo.createQuotationTemplate(tenantId, userId, {
    ...input,
    productFamily,
    version,
    sections,
    defaultTerms,
    defaultWarranty,
    defaultExclusions,
    printLayout,
  })
  return mapWithNames(tenantId, row)
}

export async function updateQuotationTemplate(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateQuotationTemplateInput,
) {
  const existing = await repo.findQuotationTemplateById(tenantId, id)
  if (!existing) throw new NotFoundError('Quotation template not found')
  const row = await repo.updateQuotationTemplate(tenantId, id, userId, input)
  return mapWithNames(tenantId, row)
}

export async function duplicateQuotationTemplate(
  tenantId: string,
  id: string,
  userId: string,
  input: DuplicateQuotationTemplateInput,
) {
  const source = await repo.findQuotationTemplateById(tenantId, id)
  if (!source) throw new NotFoundError('Quotation template not found')
  const row = await repo.createQuotationTemplate(tenantId, userId, {
    templateName: input.templateName?.trim() || `${source.templateName} (Copy)`,
    productFamily: source.productFamily,
    version: (source.version ?? 1) + 1,
    sections: Array.isArray(source.sections) ? (source.sections as unknown[]) : [],
    defaultTerms: source.defaultTerms,
    defaultWarranty: source.defaultWarranty,
    defaultExclusions: source.defaultExclusions,
    printLayout: source.printLayout,
    isActive: true,
  })
  return mapWithNames(tenantId, row)
}

export async function deleteQuotationTemplate(tenantId: string, id: string, userId: string) {
  const existing = await repo.findQuotationTemplateById(tenantId, id)
  if (!existing) throw new NotFoundError('Quotation template not found')
  await repo.softDeleteQuotationTemplate(tenantId, id, userId)
}
