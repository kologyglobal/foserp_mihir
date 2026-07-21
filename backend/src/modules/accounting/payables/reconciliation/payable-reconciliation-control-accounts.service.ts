import { prisma } from '../../../../config/database.js'
import type { ControlAccountInfo, ReconciliationExceptionDraft } from './payable-reconciliation.types.js'

/**
 * Resolves the AP "control account" universe for a legal entity, from three independent
 * sources so misconfiguration itself becomes a reportable exception rather than a silent gap:
 *  1. Accounts typed VENDOR_PAYABLE (leaf accounts only).
 *  2. The DefaultAccountMapping(VENDOR_PAYABLE) target (may or may not overlap with #1).
 *  3. Any account actually referenced by a PayableOpenItem.vendorPayableAccountId (catches
 *     historical postings against an account that is no longer / never was typed VENDOR_PAYABLE).
 */
export async function resolveControlAccounts(
  tenantId: string,
  legalEntityId: string,
): Promise<{ accounts: ControlAccountInfo[]; exceptions: ReconciliationExceptionDraft[] }> {
  const exceptions: ReconciliationExceptionDraft[] = []

  const [typedAccounts, mapping, distinctOpenItemAccountIds] = await Promise.all([
    prisma.account.findMany({
      where: { tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
      select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true },
    }),
    prisma.defaultAccountMapping.findFirst({
      where: { tenantId, legalEntityId, mappingKey: 'VENDOR_PAYABLE' },
      include: { account: { select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true } } },
    }),
    prisma.payableOpenItem.findMany({
      where: { tenantId, legalEntityId },
      select: { vendorPayableAccountId: true },
      distinct: ['vendorPayableAccountId'],
      take: 500,
    }),
  ])

  const byId = new Map<string, ControlAccountInfo>()
  for (const a of typedAccounts) {
    byId.set(a.id, { accountId: a.id, accountCode: a.accountCode, accountName: a.accountName, isActive: a.isActive, isGroup: a.isGroup })
  }

  if (!mapping) {
    exceptions.push({
      severity: 'WARNING',
      category: 'CONTROL_ACCOUNT_CONFIGURATION',
      code: 'VENDOR_PAYABLE_MAPPING_MISSING',
      message: 'No DefaultAccountMapping is configured for VENDOR_PAYABLE on this legal entity',
    })
  } else {
    if (!byId.has(mapping.account.id)) {
      byId.set(mapping.account.id, {
        accountId: mapping.account.id,
        accountCode: mapping.account.accountCode,
        accountName: mapping.account.accountName,
        isActive: mapping.account.isActive,
        isGroup: mapping.account.isGroup,
      })
    }
    if (mapping.account.isGroup) {
      exceptions.push({
        severity: 'ERROR',
        category: 'CONTROL_ACCOUNT_CONFIGURATION',
        code: 'VENDOR_PAYABLE_MAPPING_IS_GROUP',
        message: `DefaultAccountMapping(VENDOR_PAYABLE) points to group account ${mapping.account.accountCode}, which cannot receive postings`,
        accountId: mapping.account.id,
      })
    }
    if (!mapping.account.isActive) {
      exceptions.push({
        severity: 'WARNING',
        category: 'CONTROL_ACCOUNT_CONFIGURATION',
        code: 'VENDOR_PAYABLE_MAPPING_INACTIVE',
        message: `DefaultAccountMapping(VENDOR_PAYABLE) points to inactive account ${mapping.account.accountCode}`,
        accountId: mapping.account.id,
      })
    }
  }

  const openItemAccountIds = [
    ...new Set(distinctOpenItemAccountIds.map((r) => r.vendorPayableAccountId).filter((id): id is string => Boolean(id))),
  ]
  const missingIds = openItemAccountIds.filter((id) => !byId.has(id))
  if (missingIds.length > 0) {
    const rows = await prisma.account.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true },
    })
    for (const a of rows) {
      byId.set(a.id, { accountId: a.id, accountCode: a.accountCode, accountName: a.accountName, isActive: a.isActive, isGroup: a.isGroup })
      exceptions.push({
        severity: 'WARNING',
        category: 'CONTROL_ACCOUNT_CONFIGURATION',
        code: 'OPEN_ITEM_ACCOUNT_NOT_TYPED_VENDOR_PAYABLE',
        message: `Open items post to account ${a.accountCode} which is not typed VENDOR_PAYABLE`,
        accountId: a.id,
      })
    }
  }

  const accounts = [...byId.values()]
  if (accounts.length === 0) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'CONTROL_ACCOUNT_CONFIGURATION',
      code: 'NO_VENDOR_PAYABLE_CONTROL_ACCOUNT',
      message: 'No VENDOR_PAYABLE control account could be resolved for this legal entity',
    })
  }

  return { accounts, exceptions }
}
