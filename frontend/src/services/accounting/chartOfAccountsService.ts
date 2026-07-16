/**
 * Chart of Accounts mock service — Promise-based so a real API can replace this later.
 * Demo / UI only. Does not post real ledger entries.
 *
 * SECURITY: All mutations must also be enforced by the future backend
 * (tenant isolation + accounting.coa.* permissions). UI gating alone is not security.
 */

import { seedChartOfAccountsDemo, seedCoaDimensionLookups } from '../../data/accounting/chartOfAccountsSeed'
import type {
  AccountBalance,
  AccountExportFormat,
  AccountExportScope,
  AccountFilter,
  AccountFormInput,
  AccountHierarchyNode,
  AccountImportPreview,
  AccountImportPreviewRow,
  AccountLedgerPreviewLine,
  AccountType,
  ChartOfAccount,
} from '../../types/chartOfAccounts'
import { DEFAULT_ACCOUNT_FILTER as FILTER_DEFAULTS } from '../../types/chartOfAccounts'
import { getSessionUser } from '../../utils/permissions'

export class ChartOfAccountsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChartOfAccountsServiceError'
  }
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

let accountsStore: ChartOfAccount[] = seedChartOfAccountsDemo()
let importHistory: { at: string; fileName: string; rowCount: number }[] = []

function currentUser(): string {
  try {
    return getSessionUser().name
  } catch {
    return 'Demo User'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

function childrenOf(id: string, list = accountsStore): ChartOfAccount[] {
  return list.filter((a) => a.parentId === id)
}

function hasDescendant(rootId: string, candidateParentId: string | null, list: ChartOfAccount[]): boolean {
  if (!candidateParentId) return false
  if (candidateParentId === rootId) return true
  const parent = list.find((a) => a.id === candidateParentId)
  if (!parent?.parentId) return false
  return hasDescendant(rootId, parent.parentId, list)
}

function categoryCompatible(parent: ChartOfAccount | undefined, category: ChartOfAccount['category']): boolean {
  if (!parent) return true
  return parent.category === category
}

export function validateAccountInput(
  input: AccountFormInput,
  opts: { id?: string; accounts?: ChartOfAccount[] } = {},
): string[] {
  const list = opts.accounts ?? accountsStore
  const errors: string[] = []
  const code = input.code.trim()
  const name = input.name.trim()

  if (!code) errors.push('Account Code is required')
  if (!name) errors.push('Account Name is required')
  if (!input.accountType) errors.push('Account Type is required')
  if (!input.category) errors.push('Account Category is required')

  if (code && list.some((a) => a.code === code && a.id !== opts.id)) {
    errors.push('Account Code must be unique')
  }

  const isRootApproved =
    !input.parentId &&
    input.accountType === 'Group' &&
    ['1000', '2000', '3000', '4000', '5000', '6000'].includes(code)

  if (!input.parentId && !isRootApproved && input.accountType === 'Posting') {
    errors.push('Posting accounts must be placed below a group')
  }
  if (!input.parentId && !isRootApproved && input.accountType === 'Group' && code) {
    // Allow creating new roots only when they match approved pattern; otherwise require parent
    if (!['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(input.category)) {
      errors.push('Parent Account is required except for approved root groups')
    } else if (!isRootApproved) {
      errors.push('Parent Account is required except for approved root groups')
    }
  }

  if (input.parentId) {
    const parent = list.find((a) => a.id === input.parentId)
    if (!parent) {
      errors.push('Parent Account is required')
    } else {
      if (parent.accountType === 'Posting') {
        errors.push('Parent account must be a Group account')
      }
      if (!categoryCompatible(parent, input.category)) {
        errors.push('Parent and child categories must be compatible')
      }
      if (opts.id && hasDescendant(opts.id, input.parentId, list)) {
        errors.push('Circular account hierarchy is not allowed')
      }
      if (opts.id && input.parentId === opts.id) {
        errors.push('An account cannot be its own parent')
      }
    }
  }

  if (input.accountType === 'Group') {
    if (input.posting.allowDirectPosting) {
      errors.push('Group accounts cannot allow direct posting')
    }
    if (input.posting.isControlAccount) {
      errors.push('Group accounts cannot be control accounts')
    }
  }

  if (input.accountType === 'Posting') {
    if (input.posting.allowDirectPosting === undefined) {
      errors.push('Posting accounts must allow or explicitly block direct posting')
    }
  }

  if (input.posting.isControlAccount && input.posting.allowDirectPosting) {
    // Warning only at service level — UI shows warning; not a hard error
  }

  if (input.systemAccount && opts.id) {
    const existing = list.find((a) => a.id === opts.id)
    if (existing?.systemAccount && input.code.trim() !== existing.code) {
      errors.push('System account code cannot be changed')
    }
  }

  return errors
}

function matchesFilter(account: ChartOfAccount, filter: AccountFilter, list: ChartOfAccount[]): boolean {
  const parent = account.parentId ? list.find((a) => a.id === account.parentId) : undefined
  const q = filter.search.trim().toLowerCase()
  if (q) {
    const hay = [account.code, account.name, account.alias, account.category, parent?.name ?? '']
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.category && account.category !== filter.category) return false
  if (filter.accountType && account.accountType !== filter.accountType) return false
  if (filter.parentId && account.parentId !== filter.parentId) return false
  if (filter.normalBalance && account.normalBalance !== filter.normalBalance) return false
  if (filter.directPosting === 'yes' && !account.posting.allowDirectPosting) return false
  if (filter.directPosting === 'no' && account.posting.allowDirectPosting) return false
  if (filter.controlAccount === 'yes' && !account.posting.isControlAccount) return false
  if (filter.controlAccount === 'no' && account.posting.isControlAccount) return false
  if (filter.activeStatus === 'Active' && !account.active) return false
  if (filter.activeStatus === 'Inactive' && account.active) return false
  if (filter.gstRelevant === 'yes' && !account.tax.gstRelevant) return false
  if (filter.gstRelevant === 'no' && account.tax.gstRelevant) return false
  if (filter.tdsRelevant === 'yes' && !account.tax.tdsRelevant) return false
  if (filter.tdsRelevant === 'no' && account.tax.tdsRelevant) return false
  if (filter.reconciliationRequired === 'yes' && !account.posting.reconciliationRequired) return false
  if (filter.reconciliationRequired === 'no' && account.posting.reconciliationRequired) return false
  if (filter.costCentreRequired === 'yes' && !account.posting.costCentreRequired) return false
  if (filter.costCentreRequired === 'no' && account.posting.costCentreRequired) return false
  if (filter.hasBalance === 'yes' && account.currentBalance === 0) return false
  if (filter.hasBalance === 'no' && account.currentBalance !== 0) return false
  if (filter.createdBy && !account.createdBy.toLowerCase().includes(filter.createdBy.toLowerCase())) return false
  if (filter.createdDateFrom && account.createdAt.slice(0, 10) < filter.createdDateFrom) return false
  if (filter.createdDateTo && account.createdAt.slice(0, 10) > filter.createdDateTo) return false

  if (filter.listTab === 'posting' && account.accountType !== 'Posting') return false
  if (filter.listTab === 'group' && account.accountType !== 'Group') return false
  if (filter.listTab === 'inactive' && account.active) return false
  if (filter.listTab === 'control' && !account.posting.isControlAccount) return false

  if (filter.treeGroupId) {
    const inTree = (id: string | null): boolean => {
      if (!id) return false
      if (id === filter.treeGroupId) return true
      const node = list.find((a) => a.id === id)
      return node ? inTree(node.parentId) : false
    }
    if (account.id !== filter.treeGroupId && !inTree(account.parentId)) return false
  }

  return true
}

function buildHierarchy(list: ChartOfAccount[]): AccountHierarchyNode[] {
  const byParent = new Map<string | null, ChartOfAccount[]>()
  for (const a of list) {
    const key = a.parentId
    const arr = byParent.get(key) ?? []
    arr.push(a)
    byParent.set(key, arr)
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  }

  const countDescendants = (id: string): number => {
    const kids = byParent.get(id) ?? []
    return kids.reduce((sum, k) => sum + 1 + countDescendants(k.id), 0)
  }

  const walk = (parentId: string | null): AccountHierarchyNode[] => {
    return (byParent.get(parentId) ?? [])
      .filter((a) => a.accountType === 'Group')
      .map((a) => {
        const children = walk(a.id)
        const directKids = byParent.get(a.id) ?? []
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          accountType: a.accountType,
          category: a.category,
          parentId: a.parentId,
          childCount: directKids.length,
          descendantCount: countDescendants(a.id),
          children,
        }
      })
  }

  return walk(null)
}

export async function getAccounts(filter?: Partial<AccountFilter>): Promise<ChartOfAccount[]> {
  await delay()
  const f: AccountFilter = { ...FILTER_DEFAULTS, ...filter }
  return clone(accountsStore.filter((a) => matchesFilter(a, f, accountsStore))).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  )
}

export async function getAccountHierarchy(): Promise<AccountHierarchyNode[]> {
  await delay()
  return clone(buildHierarchy(accountsStore))
}

export async function getAccountById(id: string): Promise<ChartOfAccount | null> {
  await delay()
  const found = accountsStore.find((a) => a.id === id)
  return found ? clone(found) : null
}

export async function createAccount(input: AccountFormInput): Promise<ChartOfAccount> {
  await delay(180)
  const errors = validateAccountInput(input)
  if (errors.length) throw new ChartOfAccountsServiceError(errors.join('; '))

  const stamp = nowIso()
  const account: ChartOfAccount = {
    id: `coa-${input.code.trim()}`,
    code: input.code.trim(),
    name: input.name.trim(),
    alias: input.alias.trim(),
    accountType: input.accountType,
    category: input.category,
    parentId: input.parentId,
    normalBalance: input.normalBalance,
    description: input.description.trim(),
    active: input.active,
    systemAccount: false,
    posting:
      input.accountType === 'Group'
        ? {
            ...input.posting,
            allowDirectPosting: false,
            allowManualJournalPosting: false,
            isControlAccount: false,
            controlAccountType: null,
          }
        : input.posting,
    tax: input.tax,
    manufacturing: input.manufacturing,
    dimensions: input.dimensions,
    currentBalance: 0,
    hasLedgerActivity: false,
    createdBy: currentUser(),
    createdAt: stamp,
    modifiedBy: currentUser(),
    modifiedAt: stamp,
  }
  accountsStore = [...accountsStore, account]
  return clone(account)
}

export async function updateAccount(id: string, input: AccountFormInput): Promise<ChartOfAccount> {
  await delay(180)
  const existing = accountsStore.find((a) => a.id === id)
  if (!existing) throw new ChartOfAccountsServiceError('Account not found')
  if (existing.systemAccount && input.systemAccount === false) {
    throw new ChartOfAccountsServiceError('System accounts cannot remove the system flag')
  }

  const errors = validateAccountInput(input, { id })
  if (errors.length) throw new ChartOfAccountsServiceError(errors.join('; '))

  const updated: ChartOfAccount = {
    ...existing,
    code: existing.systemAccount ? existing.code : input.code.trim(),
    name: input.name.trim(),
    alias: input.alias.trim(),
    accountType: input.accountType,
    category: input.category,
    parentId: input.parentId,
    normalBalance: input.normalBalance,
    description: input.description.trim(),
    active: input.active,
    systemAccount: existing.systemAccount,
    posting:
      input.accountType === 'Group'
        ? {
            ...input.posting,
            allowDirectPosting: false,
            allowManualJournalPosting: false,
            isControlAccount: false,
            controlAccountType: null,
          }
        : input.posting,
    tax: input.tax,
    manufacturing: input.manufacturing,
    dimensions: input.dimensions,
    modifiedBy: currentUser(),
    modifiedAt: nowIso(),
  }
  accountsStore = accountsStore.map((a) => (a.id === id ? updated : a))
  return clone(updated)
}

export async function duplicateAccount(id: string): Promise<ChartOfAccount> {
  await delay(160)
  const source = accountsStore.find((a) => a.id === id)
  if (!source) throw new ChartOfAccountsServiceError('Account not found')
  let suffix = 1
  let newCode = `${source.code}-C${suffix}`
  while (accountsStore.some((a) => a.code === newCode)) {
    suffix += 1
    newCode = `${source.code}-C${suffix}`
  }
  const stamp = nowIso()
  const copy: ChartOfAccount = {
    ...clone(source),
    id: `coa-${newCode}`,
    code: newCode,
    name: `${source.name} (Copy)`,
    systemAccount: false,
    currentBalance: 0,
    hasLedgerActivity: false,
    active: true,
    deactivatedReason: null,
    createdBy: currentUser(),
    createdAt: stamp,
    modifiedBy: currentUser(),
    modifiedAt: stamp,
  }
  accountsStore = [...accountsStore, copy]
  return clone(copy)
}

export async function activateAccount(id: string): Promise<ChartOfAccount> {
  await delay(100)
  const acc = accountsStore.find((a) => a.id === id)
  if (!acc) throw new ChartOfAccountsServiceError('Account not found')
  const updated = { ...acc, active: true, deactivatedReason: null, modifiedBy: currentUser(), modifiedAt: nowIso() }
  accountsStore = accountsStore.map((a) => (a.id === id ? updated : a))
  return clone(updated)
}

export async function deactivateAccount(id: string, reason: string): Promise<ChartOfAccount> {
  await delay(100)
  if (!reason.trim()) throw new ChartOfAccountsServiceError('Deactivation reason is required')
  const acc = accountsStore.find((a) => a.id === id)
  if (!acc) throw new ChartOfAccountsServiceError('Account not found')
  const updated = {
    ...acc,
    active: false,
    deactivatedReason: reason.trim(),
    modifiedBy: currentUser(),
    modifiedAt: nowIso(),
  }
  accountsStore = accountsStore.map((a) => (a.id === id ? updated : a))
  return clone(updated)
}

export async function deleteAccount(id: string): Promise<void> {
  await delay(120)
  const acc = accountsStore.find((a) => a.id === id)
  if (!acc) throw new ChartOfAccountsServiceError('Account not found')
  if (acc.systemAccount) throw new ChartOfAccountsServiceError('System accounts cannot be deleted')
  if (childrenOf(id).length > 0) {
    throw new ChartOfAccountsServiceError('Accounts with child accounts cannot be deleted')
  }
  if (acc.hasLedgerActivity) {
    throw new ChartOfAccountsServiceError('Accounts with ledger activity cannot be deleted')
  }
  accountsStore = accountsStore.filter((a) => a.id !== id)
}

export async function getAccountBalance(id: string): Promise<AccountBalance> {
  await delay()
  const acc = accountsStore.find((a) => a.id === id)
  if (!acc) throw new ChartOfAccountsServiceError('Account not found')
  const closing = acc.currentBalance
  const opening = Math.round(closing * 0.85 * 100) / 100
  const movement = closing - opening
  const debitMovement = movement >= 0 ? movement : 0
  const creditMovement = movement < 0 ? Math.abs(movement) : Math.round(Math.abs(opening) * 0.1 * 100) / 100
  return {
    accountId: id,
    openingBalance: opening,
    debitMovement,
    creditMovement,
    closingBalance: closing,
    isDemo: true,
  }
}

export async function getAccountLedgerPreview(id: string): Promise<AccountLedgerPreviewLine[]> {
  await delay()
  const acc = accountsStore.find((a) => a.id === id)
  if (!acc) throw new ChartOfAccountsServiceError('Account not found')
  if (!acc.hasLedgerActivity) return []
  // Demo preview lines only — not real posting
  const lines: AccountLedgerPreviewLine[] = [
    {
      id: `${id}-led-1`,
      date: '2026-04-05',
      voucherNo: 'JV-2604-001',
      narration: `Opening / demo movement — ${acc.name}`,
      debit: acc.normalBalance === 'Debit' ? Math.abs(acc.currentBalance) * 0.2 : 0,
      credit: acc.normalBalance === 'Credit' ? Math.abs(acc.currentBalance) * 0.2 : 0,
      balance: Math.round(acc.currentBalance * 0.2 * 100) / 100,
      isDemo: true,
    },
    {
      id: `${id}-led-2`,
      date: '2026-05-12',
      voucherNo: 'JV-2605-014',
      narration: 'Demo ledger preview (not posted)',
      debit: acc.normalBalance === 'Debit' ? Math.abs(acc.currentBalance) * 0.35 : 0,
      credit: acc.normalBalance === 'Credit' ? Math.abs(acc.currentBalance) * 0.35 : 0,
      balance: Math.round(acc.currentBalance * 0.55 * 100) / 100,
      isDemo: true,
    },
    {
      id: `${id}-led-3`,
      date: '2026-06-28',
      voucherNo: 'JV-2606-022',
      narration: 'Demo closing movement',
      debit: acc.normalBalance === 'Debit' ? Math.abs(acc.currentBalance) * 0.45 : 0,
      credit: acc.normalBalance === 'Credit' ? Math.abs(acc.currentBalance) * 0.45 : 0,
      balance: acc.currentBalance,
      isDemo: true,
    },
  ]
  return lines
}

export async function validateAccountImport(fileName: string, csvText: string): Promise<AccountImportPreview> {
  await delay(220)
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const dataLines = lines[0]?.toLowerCase().includes('account code') ? lines.slice(1) : lines
  const rows: AccountImportPreviewRow[] = []
  const seen = new Set<string>()

  dataLines.forEach((line, idx) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const [code, name, accountType, category, parentAccountCode, normalBalance, directPosting, controlAccount, active] =
      cols
    const errors: string[] = []
    if (!code) errors.push('Missing mandatory field: Account Code')
    if (!name) errors.push('Missing mandatory field: Account Name')
    if (!accountType || !['Group', 'Posting'].includes(accountType)) errors.push('Invalid account type')
    if (!category || !['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(category)) {
      errors.push('Invalid category')
    }
    if (code && (seen.has(code) || accountsStore.some((a) => a.code === code))) {
      errors.push('Duplicate account code')
    }
    if (code) seen.add(code)
    if (parentAccountCode) {
      const parentExists =
        accountsStore.some((a) => a.code === parentAccountCode) ||
        dataLines.some((l) => l.split(',')[0]?.trim() === parentAccountCode)
      if (!parentExists) errors.push('Missing parent account')
      if (parentAccountCode === code) errors.push('Circular hierarchy')
    }
    rows.push({
      rowNumber: idx + 2,
      code: code ?? '',
      name: name ?? '',
      accountType: accountType ?? '',
      category: category ?? '',
      parentAccountCode: parentAccountCode ?? '',
      normalBalance: normalBalance ?? '',
      directPosting: directPosting ?? '',
      controlAccount: controlAccount ?? '',
      active: active ?? '',
      status: errors.length ? 'error' : 'valid',
      errors,
    })
  })

  return {
    fileName: fileName || 'import.csv',
    totalRows: rows.length,
    validRows: rows.filter((r) => r.status === 'valid').length,
    errorRows: rows.filter((r) => r.status === 'error').length,
    warningRows: 0,
    rows,
    isDemoPreview: true,
  }
}

export async function importAccounts(preview: AccountImportPreview): Promise<{ imported: number; message: string }> {
  await delay(200)
  if (preview.errorRows > 0) {
    throw new ChartOfAccountsServiceError('Resolve validation errors before confirming import')
  }
  let imported = 0
  for (const row of preview.rows.filter((r) => r.status === 'valid')) {
    if (accountsStore.some((a) => a.code === row.code)) continue
    const parent = accountsStore.find((a) => a.code === row.parentAccountCode)
    const accountType = (row.accountType === 'Group' ? 'Group' : 'Posting') as AccountType
    const stamp = nowIso()
    accountsStore.push({
      id: `coa-${row.code}`,
      code: row.code,
      name: row.name,
      alias: '',
      accountType,
      category: row.category as ChartOfAccount['category'],
      parentId: parent?.id ?? null,
      normalBalance: (row.normalBalance === 'Credit' ? 'Credit' : 'Debit') as ChartOfAccount['normalBalance'],
      description: `Imported from ${preview.fileName} (demo session)`,
      active: row.active.toLowerCase() !== 'false' && row.active.toLowerCase() !== 'n',
      systemAccount: false,
      posting: {
        allowDirectPosting: accountType === 'Posting' && row.directPosting.toLowerCase() !== 'n',
        allowManualJournalPosting: accountType === 'Posting',
        reconciliationRequired: false,
        isControlAccount: row.controlAccount.toLowerCase() === 'y' || row.controlAccount.toLowerCase() === 'true',
        controlAccountType: null,
        allowOpeningBalance: accountType === 'Posting',
        costCentreRequired: false,
        projectRequired: false,
        departmentRequired: false,
        blockNegativeBalance: false,
        currency: 'INR',
        postingDescriptionRequired: false,
      },
      tax: {
        gstRelevant: false,
        gstAccountType: 'Not Applicable',
        tdsRelevant: false,
        tdsAccountType: 'Not Applicable',
        tcsRelevant: false,
        reverseChargeApplicable: false,
        statutoryAccount: false,
        complianceNotes: '',
      },
      manufacturing: {
        manufacturingAccount: false,
        manufacturingAccountType: 'Not Applicable',
        inventoryValuationAccount: false,
        consumptionAccount: false,
        wipAccount: false,
        finishedGoodsAccount: false,
        cogsAccount: false,
        purchaseVarianceAccount: false,
        productionVarianceAccount: false,
        scrapAccount: false,
        overheadAccount: false,
        costElementType: null,
      },
      dimensions: {
        defaultCostCentreId: null,
        costCentreMandatory: false,
        defaultDepartmentId: null,
        departmentMandatory: false,
        defaultProjectId: null,
        projectMandatory: false,
        defaultPlantId: null,
        plantMandatory: false,
        defaultLocationId: null,
        locationMandatory: false,
      },
      currentBalance: 0,
      hasLedgerActivity: false,
      createdBy: currentUser(),
      createdAt: stamp,
      modifiedBy: currentUser(),
      modifiedAt: stamp,
    })
    imported += 1
  }
  importHistory.push({ at: nowIso(), fileName: preview.fileName, rowCount: imported })
  return {
    imported,
    message: `Demo import staged ${imported} account(s) in this browser session only — not permanently saved to the database.`,
  }
}

export async function exportAccounts(
  scope: AccountExportScope,
  format: AccountExportFormat,
  filter?: Partial<AccountFilter>,
): Promise<{ fileName: string; mime: string; content: string; message: string }> {
  await delay(150)
  let list = await getAccounts(scope === 'current_view' ? filter : undefined)
  if (scope === 'posting') list = list.filter((a) => a.accountType === 'Posting')
  if (scope === 'group') list = list.filter((a) => a.accountType === 'Group')
  if (scope === 'all' || scope === 'hierarchy' || scope === 'audit') {
    list = await getAccounts({})
  }

  const header =
    scope === 'audit'
      ? 'Account Code,Account Name,Created By,Created Date,Modified By,Modified Date'
      : 'Account Code,Account Name,Account Type,Category,Parent Account Code,Normal Balance,Direct Posting,Control Account,Active,Current Balance'

  const parentCode = (id: string | null) => accountsStore.find((a) => a.id === id)?.code ?? ''

  const body = list
    .map((a) => {
      if (scope === 'audit') {
        return [a.code, a.name, a.createdBy, a.createdAt, a.modifiedBy, a.modifiedAt].join(',')
      }
      return [
        a.code,
        `"${a.name.replace(/"/g, '""')}"`,
        a.accountType,
        a.category,
        parentCode(a.parentId),
        a.normalBalance,
        a.posting.allowDirectPosting ? 'Y' : 'N',
        a.posting.isControlAccount ? 'Y' : 'N',
        a.active ? 'Y' : 'N',
        a.currentBalance,
      ].join(',')
    })
    .join('\n')

  const content = `${header}\n${body}`
  const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'csv' : 'csv'
  const fileName = `chart-of-accounts-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`

  if (format === 'pdf') {
    return {
      fileName,
      mime: 'text/plain',
      content: `PDF export is a frontend placeholder.\n\n${content}`,
      message: 'PDF export is not wired to a report engine yet — downloaded a text placeholder.',
    }
  }

  return {
    fileName,
    mime: 'text/csv;charset=utf-8',
    content,
    message: `Exported ${list.length} account(s) as ${format.toUpperCase()} (demo download).`,
  }
}

export async function getDimensionLookups() {
  await delay(40)
  return seedCoaDimensionLookups()
}

export async function getCoaSummary() {
  await delay(40)
  const all = accountsStore
  return {
    total: all.length,
    posting: all.filter((a) => a.accountType === 'Posting').length,
    group: all.filter((a) => a.accountType === 'Group').length,
    inactive: all.filter((a) => !a.active).length,
    withBalance: all.filter((a) => a.currentBalance !== 0).length,
  }
}

export function getImportTemplateCsv(): string {
  return [
    'Account Code,Account Name,Account Type,Category,Parent Account Code,Normal Balance,Direct Posting,Control Account,Active',
    '1199,Demo Advance Account,Posting,Asset,1150,Debit,Y,N,Y',
  ].join('\n')
}

export function resetChartOfAccountsDemo(): void {
  accountsStore = seedChartOfAccountsDemo()
  importHistory = []
}

export { FILTER_DEFAULTS as DEFAULT_COA_FILTER }
export type { AccountFilter }
