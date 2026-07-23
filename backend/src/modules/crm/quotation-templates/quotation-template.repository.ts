import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import type { ListQuotationTemplatesQuery } from './quotation-template.validation.js'
import { toTemplateJson } from './quotation-template.types.js'

export async function findQuotationTemplates(
  tenantId: string,
  query: ListQuotationTemplatesQuery,
  catalogCodes?: string[],
) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...tenantActiveFilter(tenantId),
    ...(catalogCodes && catalogCodes.length > 0 ? { code: { in: catalogCodes } } : {}),
    ...(query.productFamily ? { productFamily: query.productFamily } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { templateName: { contains: query.search } },
            { productFamily: { contains: query.search } },
            { code: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmQuotationTemplate.findMany({
      where,
      orderBy: [{ productFamily: 'asc' }, { templateName: 'asc' }],
      skip,
      take,
    }),
    prisma.crmQuotationTemplate.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function findQuotationTemplateById(tenantId: string, id: string) {
  return prisma.crmQuotationTemplate.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
}

export async function findQuotationTemplateByCode(tenantId: string, code: string) {
  return prisma.crmQuotationTemplate.findFirst({
    where: { code, ...tenantActiveFilter(tenantId) },
  })
}

function slugCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return base || `TPL-${Date.now().toString(36).toUpperCase()}`
}

export async function createQuotationTemplate(
  tenantId: string,
  userId: string,
  input: {
    code?: string
    templateName: string
    productFamily?: string
    version?: number
    sections: unknown[]
    defaultTerms?: string
    defaultWarranty?: string
    defaultExclusions?: string
    printLayout?: unknown | null
    isActive?: boolean
  },
) {
  let code = (input.code?.trim() || slugCode(input.templateName)).slice(0, 64)
  const existing = await findQuotationTemplateByCode(tenantId, code)
  if (existing) {
    code = `${code.slice(0, 48)}-${Date.now().toString(36).toUpperCase()}`.slice(0, 64)
  }

  return prisma.crmQuotationTemplate.create({
    data: {
      tenantId,
      code,
      templateName: input.templateName.trim(),
      productFamily: input.productFamily?.trim() || 'Custom',
      version: input.version ?? 1,
      sections: toTemplateJson(input.sections),
      defaultTerms: input.defaultTerms ?? '',
      defaultWarranty: input.defaultWarranty ?? '',
      defaultExclusions: input.defaultExclusions ?? '',
      printLayout: input.printLayout == null ? undefined : toTemplateJson(input.printLayout),
      isActive: input.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateQuotationTemplate(
  _tenantId: string,
  id: string,
  userId: string,
  input: {
    templateName?: string
    productFamily?: string
    version?: number
    sections?: unknown[]
    defaultTerms?: string
    defaultWarranty?: string
    defaultExclusions?: string
    printLayout?: unknown | null
    isActive?: boolean
  },
) {
  const data: Prisma.CrmQuotationTemplateUpdateInput = {
    updatedBy: userId,
  }
  if (input.templateName !== undefined) data.templateName = input.templateName.trim()
  if (input.productFamily !== undefined) data.productFamily = input.productFamily.trim()
  if (input.version !== undefined) data.version = input.version
  if (input.sections !== undefined) data.sections = toTemplateJson(input.sections)
  if (input.defaultTerms !== undefined) data.defaultTerms = input.defaultTerms
  if (input.defaultWarranty !== undefined) data.defaultWarranty = input.defaultWarranty
  if (input.defaultExclusions !== undefined) data.defaultExclusions = input.defaultExclusions
  if (input.printLayout !== undefined) {
    data.printLayout = input.printLayout == null ? Prisma.JsonNull : toTemplateJson(input.printLayout)
  }
  if (input.isActive !== undefined) data.isActive = input.isActive

  return prisma.crmQuotationTemplate.update({
    where: { id },
    data,
  })
}

export async function softDeleteQuotationTemplate(_tenantId: string, id: string, userId: string) {
  return prisma.crmQuotationTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId, isActive: false },
  })
}

/** Create/restore keep-catalog rows when live DB is missing one (e.g. only ISO-TANK-26KL). */
export async function ensureKeptQuotationTemplates(
  tenantId: string,
  rows: Array<{
    code: string
    templateName: string
    productFamily: string
    version: number
    sections: unknown[]
    defaultTerms: string
    defaultWarranty: string
    defaultExclusions: string
    printLayout: unknown
  }>,
) {
  let changed = false
  for (const row of rows) {
    const existing = await prisma.crmQuotationTemplate.findFirst({
      where: { tenantId, code: row.code },
      select: { id: true, deletedAt: true, isActive: true },
    })
    if (!existing) {
      await prisma.crmQuotationTemplate.create({
        data: {
          tenantId,
          code: row.code,
          templateName: row.templateName,
          productFamily: row.productFamily,
          version: row.version,
          sections: toTemplateJson(row.sections),
          defaultTerms: row.defaultTerms,
          defaultWarranty: row.defaultWarranty,
          defaultExclusions: row.defaultExclusions,
          printLayout: toTemplateJson(row.printLayout),
          isActive: true,
        },
      })
      changed = true
      continue
    }
    if (existing.deletedAt != null || !existing.isActive) {
      await prisma.crmQuotationTemplate.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          isActive: true,
          templateName: row.templateName,
          productFamily: row.productFamily,
          version: row.version,
          sections: toTemplateJson(row.sections),
          defaultTerms: row.defaultTerms,
          defaultWarranty: row.defaultWarranty,
          defaultExclusions: row.defaultExclusions,
          printLayout: toTemplateJson(row.printLayout),
        },
      })
      changed = true
    }
  }
  return changed
}
