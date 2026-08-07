/**
 * Chart of Accounts service — dual-mode:
 * - VITE_USE_API=false → in-memory demo seed (session only)
 * - VITE_USE_API=true  → live accounting API for CSV import (tenant + legal entity)
 *
 * SECURITY: Mutations must also be enforced by the backend
 * (tenant isolation + finance.coa.* permissions). UI gating alone is not security.
 */

import { isApiMode } from '../../config/apiConfig'
import { seedChartOfAccountsDemo, seedCoaDimensionLookups } from '../../data/accounting/chartOfAccountsSeed'
import * as financeApi from '../api/financeApi'
import { ensureLegalEntityId } from '../bridges/financeApiBridge'
import type { Account as FinanceAccount, AccountTreeNode as FinanceAccountTreeNode } from '../../types/financeSetup'
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
import {
  DEFAULT_ACCOUNT_FILTER as FILTER_DEFAULTS,
  defaultDimensionConfiguration,
  defaultManufacturingConfiguration,
  defaultPostingControl,
  defaultTaxConfiguration,
} from '../../types/chartOfAccounts'
import { getSessionUser } from '../../utils/permissions'

export type CoaImportDuplicateMode = 'skip' | 'update' | 'reject'

export class ChartOfAccountsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChartOfAccountsServiceError'
  }
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

let accountsStore: ChartOfAccount[] = isApiMode() ? [] : seedChartOfAccountsDemo()
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

function mapFinanceCategory(category: FinanceAccount['category']): ChartOfAccount['category'] {
  const map: Record<string, ChartOfAccount['category']> = {
    ASSET: 'Asset',
    LIABILITY: 'Liability',
    EQUITY: 'Equity',
    INCOME: 'Income',
    EXPENSE: 'Expense',
  }
  return map[category] ?? 'Asset'
}

function mapFinanceAccountToChart(a: FinanceAccount): ChartOfAccount {
  const accountType: AccountType = a.isGroup ? 'Group' : 'Posting'
  const posting = defaultPostingControl(accountType)
  posting.allowDirectPosting = !a.isGroup && a.allowManualPosting
  posting.allowManualJournalPosting = !a.isGroup && a.allowManualPosting
  posting.isControlAccount = a.isControlAccount
  posting.reconciliationRequired = a.requiresReconciliation
  posting.currency = a.currencyCode || 'INR'
  return {
    id: a.id,
    code: a.accountCode,
    name: a.accountName,
    alias: '',
    accountType,
    category: mapFinanceCategory(a.category),
    parentId: a.parentAccountId ?? null,
    normalBalance: a.normalBalance === 'CREDIT' ? 'Credit' : 'Debit',
    description: a.description ?? '',
    active: a.isActive,
    systemAccount: false,
    posting,
    tax: defaultTaxConfiguration(),
    manufacturing: defaultManufacturingConfiguration(),
    dimensions: defaultDimensionConfiguration(),
    currentBalance: 0,
    hasLedgerActivity: false,
    createdBy: '-',
    createdAt: a.createdAt ?? nowIso(),
    modifiedBy: '-',
    modifiedAt: a.updatedAt ?? a.createdAt ?? nowIso(),
  }
}

function flattenAccountTree(nodes: FinanceAccountTreeNode[]): FinanceAccount[] {
  const out: FinanceAccount[] = []
  const walk = (list: FinanceAccountTreeNode[]) => {
    for (const n of list) {
      const { children, ...rest } = n
      out.push(rest)
      if (children?.length) walk(children)
    }
  }
  walk(nodes)
  return out
}

async function loadApiAccountsCache(): Promise<ChartOfAccount[]> {
  const legalEntityId = await ensureLegalEntityId()
  const treeRes = await financeApi.getAccountTree(legalEntityId, true)
  const flat = flattenAccountTree(treeRes.data)
  return flat.map(mapFinanceAccountToChart)
}

export async function getAccounts(filter?: Partial<AccountFilter>): Promise<ChartOfAccount[]> {
  const f: AccountFilter = { ...FILTER_DEFAULTS, ...filter }
  if (isApiMode()) {
    const all = await loadApiAccountsCache()
    return clone(all.filter((a) => matchesFilter(a, f, all))).sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    )
  }
  await delay()
  return clone(accountsStore.filter((a) => matchesFilter(a, f, accountsStore))).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  )
}

export async function getAccountHierarchy(): Promise<AccountHierarchyNode[]> {
  if (isApiMode()) {
    const all = await loadApiAccountsCache()
    return clone(buildHierarchy(all))
  }
  await delay()
  return clone(buildHierarchy(accountsStore))
}

export async function getAccountById(id: string): Promise<ChartOfAccount | null> {
  if (isApiMode()) {
    const all = await loadApiAccountsCache()
    const found = all.find((a) => a.id === id)
    return found ? clone(found) : null
  }
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

/** Parse CoA CSV into header-keyed row objects (demo + live API). */
export function parseCoaImportCsv(csvText: string): Array<Record<string, string>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const looksLikeHeader = headers.some((h) => /account\s*code/i.test(h))
  const fallback = [
    'Account Code',
    'Account Name',
    'Account Type',
    'Category',
    'Parent Account Code',
    'Normal Balance',
    'Direct Posting',
    'Control Account',
    'Active',
  ]
  if (!looksLikeHeader) {
    return lines.map((line) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      fallback.forEach((h, i) => {
        row[h] = cols[i] ?? ''
      })
      return row
    })
  }
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })
}

function pickCell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
    const norm = key.toLowerCase().replace(/\s+/g, '_')
    const found = Object.entries(row).find(([k]) => k.toLowerCase().replace(/\s+/g, '_') === norm)
    if (found?.[1] != null && String(found[1]).trim() !== '') return String(found[1]).trim()
  }
  return ''
}

export async function validateAccountImport(
  fileName: string,
  csvText: string,
  _opts?: { duplicateMode?: CoaImportDuplicateMode },
): Promise<AccountImportPreview> {
  void _opts
  await delay(isApiMode() ? 80 : 220)
  const rawRows = parseCoaImportCsv(csvText)
  const rows: AccountImportPreviewRow[] = []
  const seen = new Set<string>()
  const fileCodes = new Set(
    rawRows.map((r) => pickCell(r, 'Account Code', 'account_code', 'code')).filter(Boolean),
  )

  rawRows.forEach((row, idx) => {
    const code = pickCell(row, 'Account Code', 'account_code', 'code')
    const name = pickCell(row, 'Account Name', 'account_name', 'name')
    const accountType = pickCell(row, 'Account Type', 'account_type', 'type')
    const category = pickCell(row, 'Category', 'category')
    const parentAccountCode = pickCell(row, 'Parent Account Code', 'parent_account_code', 'parent_code')
    const normalBalance = pickCell(row, 'Normal Balance', 'normal_balance')
    const directPosting = pickCell(row, 'Direct Posting', 'direct_posting')
    const controlAccount = pickCell(row, 'Control Account', 'control_account')
    const active = pickCell(row, 'Active', 'active', 'status')
    const errors: string[] = []

    if (!code) errors.push('Missing mandatory field: Account Code')
    if (!name) errors.push('Missing mandatory field: Account Name')
    if (!category) errors.push('Missing mandatory field: Category')
    if (accountType && !/^(group|posting)$/i.test(accountType) && !/^[A-Z][A-Z0-9_]*$/i.test(accountType.replace(/\s/g, '_'))) {
      errors.push('Invalid account type (use Group or Posting)')
    }
    if (category && !['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(category)) {
      errors.push('Invalid category')
    }
    if (code && seen.has(code)) errors.push('Duplicate account code in file')
    // Demo: reject if code already in session store. API mode: server applies duplicateMode.
    if (code && !isApiMode() && accountsStore.some((a) => a.code === code)) {
      errors.push('Duplicate account code')
    }
    if (code) seen.add(code)
    if (parentAccountCode) {
      if (parentAccountCode === code) errors.push('Circular hierarchy')
      if (!isApiMode()) {
        const parentExists =
          accountsStore.some((a) => a.code === parentAccountCode) || fileCodes.has(parentAccountCode)
        if (!parentExists) errors.push('Missing parent account')
      }
    }
    rows.push({
      rowNumber: idx + 2,
      code,
      name,
      accountType: accountType || 'Posting',
      category,
      parentAccountCode,
      normalBalance,
      directPosting,
      controlAccount,
      active,
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
    rawRows,
    isDemoPreview: !isApiMode(),
  }
}

export async function importAccounts(
  preview: AccountImportPreview,
  opts?: { legalEntityId?: string; duplicateMode?: CoaImportDuplicateMode },
): Promise<{ imported: number; updated: number; skipped: number; failed: number; message: string }> {
  if (isApiMode()) {
    if (preview.errorRows > 0) {
      throw new ChartOfAccountsServiceError('Resolve validation errors before confirming import')
    }
    const legalEntityId = opts?.legalEntityId
    if (!legalEntityId) throw new ChartOfAccountsServiceError('Legal entity is required for import')
    const rows =
      preview.rawRows ??
      preview.rows
        .filter((r) => r.status === 'valid')
        .map((r) => ({
          'Account Code': r.code,
          'Account Name': r.name,
          'Account Type': r.accountType,
          Category: r.category,
          'Parent Account Code': r.parentAccountCode,
          'Normal Balance': r.normalBalance,
          'Direct Posting': r.directPosting,
          'Control Account': r.controlAccount,
          Active: r.active,
        }))
    if (rows.length === 0) throw new ChartOfAccountsServiceError('No rows to import')
    const res = await financeApi.importCoaAccounts({
      legalEntityId,
      rows,
      duplicateMode: opts?.duplicateMode ?? 'skip',
    })
    const summary = res.data
    importHistory.push({
      at: nowIso(),
      fileName: preview.fileName,
      rowCount: summary.imported + summary.updated,
    })
    return {
      imported: summary.imported,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed,
      message: `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`,
    }
  }

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
    updated: 0,
    skipped: 0,
    failed: 0,
    message: `Demo import staged ${imported} account(s) in this browser session only — not permanently saved to the database.`,
  }
}

export async function exportAccounts(
  scope: AccountExportScope,
  format: AccountExportFormat,
  filter?: Partial<AccountFilter>,
): Promise<{ fileName: string; mime: string; content: string; message: string }> {
  await delay(isApiMode() ? 40 : 150)
  let list = await getAccounts(scope === 'current_view' ? filter : undefined)
  if (scope === 'posting') list = list.filter((a) => a.accountType === 'Posting')
  if (scope === 'group') list = list.filter((a) => a.accountType === 'Group')
  if (scope === 'all' || scope === 'hierarchy' || scope === 'audit') {
    list = await getAccounts({})
  }

  const allForParent = isApiMode() ? await getAccounts({}) : accountsStore
  const parentCode = (id: string | null) => allForParent.find((a) => a.id === id)?.code ?? ''

  const header =
    scope === 'audit'
      ? 'Account Code,Account Name,Created By,Created Date,Modified By,Modified Date'
      : 'Account Code,Account Name,Account Type,Category,Parent Account Code,Normal Balance,Direct Posting,Control Account,Active,Current Balance'

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
    message: isApiMode()
      ? `Exported ${list.length} account(s) as ${format.toUpperCase()}.`
      : `Exported ${list.length} account(s) as ${format.toUpperCase()} (demo download).`,
  }
}

export async function getDimensionLookups() {
  await delay(40)
  if (isApiMode()) {
    return {
      plants: [],
      locations: [],
      departments: [],
      costCentres: [],
      projects: [],
    }
  }
  return seedCoaDimensionLookups()
}

export async function getCoaSummary() {
  if (isApiMode()) {
    const all = await loadApiAccountsCache()
    return {
      total: all.length,
      posting: all.filter((a) => a.accountType === 'Posting').length,
      group: all.filter((a) => a.accountType === 'Group').length,
      inactive: all.filter((a) => !a.active).length,
      withBalance: all.filter((a) => a.currentBalance !== 0).length,
    }
  }
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
    '1000,Assets,Group,Asset,,Debit,N,N,Y',
    '1100,Current Assets,Group,Asset,1000,Debit,N,N,Y',
    '1110,Cash and Bank,Posting,Asset,1100,Debit,Y,N,Y',
  ].join('\n')
}

export async function downloadImportTemplate(): Promise<void> {
  if (isApiMode()) {
    await financeApi.downloadCoaImportTemplate()
    return
  }
  const csv = getImportTemplateCsv()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chart-of-accounts-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function resetChartOfAccountsDemo(): void {
  accountsStore = isApiMode() ? [] : seedChartOfAccountsDemo()
  importHistory = []
}

export { FILTER_DEFAULTS as DEFAULT_COA_FILTER }
export type { AccountFilter }
