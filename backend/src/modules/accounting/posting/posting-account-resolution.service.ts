import type { Account, DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { PostingPurpose, PostingRequestLine, ResolvedPostingLine } from './posting.types.js'
import { PostingError } from './posting.errors.js'

export async function resolvePostingLines(
  tenantId: string,
  legalEntityId: string,
  lines: PostingRequestLine[],
  postingPurpose: PostingPurpose,
  allowManualControlAccountPosting: boolean,
): Promise<ResolvedPostingLine[]> {
  const resolved: ResolvedPostingLine[] = []

  for (const line of lines) {
    const account = await resolveLineAccount(tenantId, legalEntityId, line, postingPurpose, allowManualControlAccountPosting)
    await validateParty(tenantId, line, account)

    resolved.push({
      lineNumber: line.lineNumber,
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
      partyNameSnapshot: line.partyNameSnapshot ?? null,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      baseDebitAmount: line.baseDebitAmount ?? line.debitAmount,
      baseCreditAmount: line.baseCreditAmount ?? line.creditAmount,
      currencyCode: line.currencyCode ?? 'INR',
      exchangeRate: line.exchangeRate ?? '1',
      costCentreId: line.costCentreId ?? null,
      projectReference: line.projectReference ?? null,
      departmentReference: line.departmentReference ?? null,
      referenceDocumentType: line.referenceDocumentType ?? null,
      referenceDocumentId: line.referenceDocumentId ?? null,
      referenceDocumentLineId: line.referenceDocumentLineId ?? null,
      dueDate: line.dueDate ?? null,
      lineNarration: line.lineNarration ?? null,
    })
  }

  return resolved
}

async function resolveLineAccount(
  tenantId: string,
  legalEntityId: string,
  line: PostingRequestLine,
  postingPurpose: PostingPurpose,
  allowManualControlAccountPosting: boolean,
): Promise<Account> {
  let account: Account | null = null

  if (line.accountId) {
    account = await prisma.account.findFirst({ where: { id: line.accountId, tenantId, legalEntityId } })
    if (!account) {
      throw new PostingError('ACCOUNT_NOT_FOUND', `Account not found for line ${line.lineNumber}`, [
        { field: `lines[${line.lineNumber}].accountId`, message: 'Account not found in legal entity' },
      ])
    }
  } else if (line.accountMappingKey) {
    const mapping = await prisma.defaultAccountMapping.findFirst({
      where: {
        tenantId,
        legalEntityId,
        mappingKey: line.accountMappingKey as DefaultAccountMappingKey,
      },
      include: { account: true },
    })
    if (!mapping?.account) {
      throw new PostingError('ACCOUNT_RESOLUTION_FAILED', `No mapping found for key ${line.accountMappingKey}`, [
        { field: `lines[${line.lineNumber}].accountMappingKey`, message: 'Default account mapping not configured' },
      ])
    }
    account = mapping.account
  } else {
    throw new PostingError('INVALID_LINE_ACCOUNT_REFERENCE', 'Each line requires accountId or accountMappingKey', [
      { field: `lines[${line.lineNumber}]`, message: 'Missing account reference' },
    ])
  }

  if (account.isGroup) {
    throw new PostingError('ACCOUNT_IS_GROUP', `Group account cannot be posted on line ${line.lineNumber}`)
  }
  if (!account.isActive) {
    throw new PostingError('ACCOUNT_INACTIVE', `Inactive account on line ${line.lineNumber}`)
  }

  if (postingPurpose === 'MANUAL_JOURNAL') {
    if (account.isControlAccount && !allowManualControlAccountPosting) {
      throw new PostingError('CONTROL_ACCOUNT_BLOCKED', `Control account ${account.accountCode} is blocked for manual journals`)
    }
    if (!account.allowManualPosting) {
      throw new PostingError('MANUAL_POSTING_BLOCKED', `Manual posting is disabled for account ${account.accountCode}`)
    }
  }

  const requiresParty =
    account.requiresParty ||
    account.accountType === 'CUSTOMER_RECEIVABLE' ||
    account.accountType === 'VENDOR_PAYABLE'

  if (requiresParty && (!line.partyType || !line.partyId)) {
    throw new PostingError('PARTY_REQUIRED', `Party is required for account ${account.accountCode} on line ${line.lineNumber}`)
  }

  return account
}

async function validateParty(tenantId: string, line: PostingRequestLine, account: Account): Promise<void> {
  if (!line.partyType || !line.partyId) return

  if (line.partyType === 'EMPLOYEE') {
    throw new PostingError('PARTY_TYPE_NOT_SUPPORTED', 'Employee party type is not supported in Phase 2B')
  }

  if (line.partyType === 'CUSTOMER') {
    const company = await prisma.crmCompany.findFirst({ where: { id: line.partyId, tenantId } })
    if (!company) {
      throw new PostingError('PARTY_NOT_FOUND', `Customer party ${line.partyId} not found`, [
        { field: `lines[${line.lineNumber}].partyId`, message: 'Customer not found' },
      ])
    }
    return
  }

  if (line.partyType === 'VENDOR') {
    const vendor = await prisma.masterVendor.findFirst({ where: { id: line.partyId, tenantId } })
    if (!vendor) {
      throw new PostingError('PARTY_NOT_FOUND', `Vendor party ${line.partyId} not found`, [
        { field: `lines[${line.lineNumber}].partyId`, message: 'Vendor not found' },
      ])
    }
    return
  }

  if (line.partyType === 'OTHER') {
    return
  }

  if (
    account.accountType === 'CUSTOMER_RECEIVABLE' &&
    line.partyType !== 'CUSTOMER'
  ) {
    throw new PostingError('PARTY_REQUIRED', 'Customer receivable accounts require CUSTOMER party type')
  }
  if (account.accountType === 'VENDOR_PAYABLE' && line.partyType !== 'VENDOR') {
    throw new PostingError('PARTY_REQUIRED', 'Vendor payable accounts require VENDOR party type')
  }
}
