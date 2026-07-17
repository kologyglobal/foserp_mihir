import type { DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import {
  MANDATORY_MAPPING_KEYS,
  MAPPING_KEY_ACCOUNT_TYPES,
  MAPPING_KEY_CATEGORIES,
} from '../shared/finance.constants.js'
import { assertAccountForMapping, getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import type { DefaultMappingsQuery, UpsertDefaultMappingsInput } from './default-mapping.validation.js'

function assertMappingCompatibility(mappingKey: DefaultAccountMappingKey, account: {
  accountType: string
  category: string
}): void {
  const allowedTypes = MAPPING_KEY_ACCOUNT_TYPES[mappingKey]
  if (allowedTypes?.length && !allowedTypes.includes(account.accountType as never)) {
    const allowedCategories = MAPPING_KEY_CATEGORIES[mappingKey]
    if (!allowedCategories?.includes(account.category as never)) {
      throw new ValidationError(`Account type incompatible with mapping key ${mappingKey}`)
    }
  }
}

export async function listMappings(tenantId: string, query: DefaultMappingsQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  return prisma.defaultAccountMapping.findMany({
    where: { tenantId, legalEntityId: query.legalEntityId },
    include: { account: { select: { id: true, accountCode: true, accountName: true, isGroup: true, isActive: true } } },
    orderBy: { mappingKey: 'asc' },
  })
}

export async function upsertMappings(tenantId: string, userId: string, input: UpsertDefaultMappingsInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  return prisma.$transaction(async (tx) => {
    const results = []
    for (const item of input.mappings) {
      const account = await tx.account.findFirst({
        where: { id: item.accountId, tenantId, legalEntityId: input.legalEntityId },
      })
      if (!account) throw new ValidationError('Selected account must belong to the same legal entity')
      assertAccountForMapping(account)
      assertMappingCompatibility(item.mappingKey, account)

      const record = await tx.defaultAccountMapping.upsert({
        where: {
          legalEntityId_mappingKey: { legalEntityId: input.legalEntityId, mappingKey: item.mappingKey },
        },
        create: {
          tenantId,
          legalEntityId: input.legalEntityId,
          mappingKey: item.mappingKey,
          accountId: item.accountId,
          isMandatory: item.isMandatory ?? MANDATORY_MAPPING_KEYS.includes(item.mappingKey),
          description: item.description,
          createdBy: userId,
          updatedBy: userId,
        },
        update: {
          accountId: item.accountId,
          isMandatory: item.isMandatory,
          description: item.description,
          updatedBy: userId,
        },
      })
      results.push(record)
    }
    return results
  })
}

export async function validateMappings(tenantId: string, legalEntityId: string) {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const existing = await prisma.defaultAccountMapping.findMany({
    where: { tenantId, legalEntityId },
    select: { mappingKey: true },
  })
  const present = new Set(existing.map((m) => m.mappingKey))
  const missing = MANDATORY_MAPPING_KEYS.filter((key) => !present.has(key))
  return {
    valid: missing.length === 0,
    missing,
    missingCount: missing.length,
    mandatoryKeys: MANDATORY_MAPPING_KEYS,
  }
}
