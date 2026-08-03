/**
 * Chart of Accounts CSV import — live API (tenant + legal entity scoped).
 * Template headers match the FE CoA import dialog.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { ConflictError, ValidationError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { MAX_ACCOUNT_DEPTH } from '../shared/finance.constants.js'

export type AccountImportDuplicateMode = 'skip' | 'update' | 'reject'

export interface AccountImportPayload {
  legalEntityId: string
  rows: Array<Record<string, string>>
  duplicateMode?: AccountImportDuplicateMode
}

export interface AccountImportRowResult {
  row: number
  ok: boolean
  code?: string
  errors?: string[]
}

export interface AccountImportSummary {
  imported: number
  updated: number
  skipped: number
  failed: number
  rows: AccountImportRowResult[]
}

const ACCOUNT_TYPE_API = new Set([
  'GENERAL',
  'BANK',
  'CASH',
  'CUSTOMER_RECEIVABLE',
  'VENDOR_PAYABLE',
  'RAW_MATERIAL_INVENTORY',
  'WIP_INVENTORY',
  'FINISHED_GOODS_INVENTORY',
  'FIXED_ASSET',
  'ACCUMULATED_DEPRECIATION',
  'GST_INPUT',
  'GST_OUTPUT',
  'TDS_RECEIVABLE',
  'TDS_PAYABLE',
  'SALES',
  'SALES_RETURN',
  'PURCHASE',
  'PURCHASE_RETURN',
  'EXPENSE',
  'OTHER_INCOME',
  'PRODUCTION_VARIANCE',
  'RETAINED_EARNINGS',
])

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_')
}

function rowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key]
    if (direct != null && String(direct).trim() !== '') return String(direct).trim()
    const normalized = Object.entries(row).find(([k]) => normalizeKey(k) === normalizeKey(key))
    if (normalized?.[1] != null && String(normalized[1]).trim() !== '') return String(normalized[1]).trim()
  }
  return ''
}

function parseYn(value: string, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  const v = value.toLowerCase()
  if (['y', 'yes', 'true', '1', 'active'].includes(v)) return true
  if (['n', 'no', 'false', '0', 'inactive'].includes(v)) return false
  return defaultValue
}

function mapCategory(raw: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | null {
  const v = raw.trim().toUpperCase()
  if (['ASSET', 'ASSETS'].includes(v)) return 'ASSET'
  if (['LIABILITY', 'LIABILITIES'].includes(v)) return 'LIABILITY'
  if (['EQUITY'].includes(v)) return 'EQUITY'
  if (['INCOME', 'REVENUE'].includes(v)) return 'INCOME'
  if (['EXPENSE', 'EXPENSES'].includes(v)) return 'EXPENSE'
  return null
}

function mapNormalBalance(raw: string, category: string): 'DEBIT' | 'CREDIT' {
  const v = raw.trim().toUpperCase()
  if (v === 'DEBIT' || v === 'DR') return 'DEBIT'
  if (v === 'CREDIT' || v === 'CR') return 'CREDIT'
  // Default by category when blank
  if (category === 'LIABILITY' || category === 'EQUITY' || category === 'INCOME') return 'CREDIT'
  return 'DEBIT'
}

function mapIsGroup(accountTypeCell: string): boolean {
  const v = accountTypeCell.trim().toLowerCase()
  if (v === 'group' || v === 'header' || v === 'true' || v === 'y' || v === 'yes') return true
  if (v === 'posting' || v === 'ledger' || v === 'false' || v === 'n' || v === 'no') return false
  // If the cell is an API account type, Group only when explicitly "GROUP" — treating unknown as Posting
  return false
}

function mapAccountType(accountTypeCell: string, isGroup: boolean): string {
  const compact = accountTypeCell.trim().toUpperCase().replace(/\s+/g, '_')
  if (ACCOUNT_TYPE_API.has(compact)) return compact
  // UI template uses Group | Posting — map to GENERAL
  if (['GROUP', 'POSTING', 'LEDGER', 'HEADER', ''].includes(compact) || isGroup) return 'GENERAL'
  return 'GENERAL'
}

export function accountImportTemplateCsv(): string {
  return [
    'Account Code,Account Name,Account Type,Category,Parent Account Code,Normal Balance,Direct Posting,Control Account,Active',
    '1000,Assets,Group,Asset,,Debit,N,N,Y',
    '1100,Current Assets,Group,Asset,1000,Debit,N,N,Y',
    '1110,Cash and Bank,Posting,Asset,1100,Debit,Y,N,Y',
    '2000,Liabilities,Group,Liability,,Credit,N,N,Y',
    '2110,Accounts Payable,Posting,Liability,2000,Credit,Y,Y,Y',
  ].join('\n')
}

interface ParsedRow {
  rowNo: number
  accountCode: string
  accountName: string
  isGroup: boolean
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
  accountType: string
  parentAccountCode: string
  normalBalance: 'DEBIT' | 'CREDIT'
  allowManualPosting: boolean
  isControlAccount: boolean
  isActive: boolean
}

function parseRow(row: Record<string, string>, rowNo: number): { parsed?: ParsedRow; errors: string[] } {
  const errors: string[] = []
  const accountCode = rowValue(row, 'Account Code', 'account_code', 'code')
  const accountName = rowValue(row, 'Account Name', 'account_name', 'name')
  const accountTypeCell = rowValue(row, 'Account Type', 'account_type', 'type')
  const categoryRaw = rowValue(row, 'Category', 'category')
  const parentAccountCode = rowValue(row, 'Parent Account Code', 'parent_account_code', 'parent_code')
  const normalBalanceRaw = rowValue(row, 'Normal Balance', 'normal_balance')
  const directPosting = rowValue(row, 'Direct Posting', 'allow_manual_posting', 'direct_posting')
  const controlAccount = rowValue(row, 'Control Account', 'is_control_account', 'control_account')
  const active = rowValue(row, 'Active', 'status', 'is_active')

  if (!accountCode) errors.push('Account Code is required')
  if (!accountName) errors.push('Account Name is required')
  const category = mapCategory(categoryRaw)
  if (!category) errors.push('Category must be Asset, Liability, Equity, Income, or Expense')

  if (errors.length || !category) return { errors }

  const isGroup = mapIsGroup(accountTypeCell)
  const accountType = mapAccountType(accountTypeCell, isGroup)
  const isControlAccount = parseYn(controlAccount, false)
  const allowManualPosting = parseYn(directPosting, !isControlAccount && !isGroup)
  const isActive = parseYn(active, true)
  const normalBalance = mapNormalBalance(normalBalanceRaw, category)

  return {
    parsed: {
      rowNo,
      accountCode,
      accountName,
      isGroup,
      category,
      accountType,
      parentAccountCode,
      normalBalance,
      allowManualPosting,
      isControlAccount,
      isActive,
    },
    errors: [],
  }
}

function topologicalOrder(rows: ParsedRow[]): { order: ParsedRow[]; errors: Array<{ rowNo: number; code: string; message: string }> } {
  const byCode = new Map(rows.map((r) => [r.accountCode, r]))
  const order: ParsedRow[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const errors: Array<{ rowNo: number; code: string; message: string }> = []

  function visit(code: string, stack: string[]) {
    if (visited.has(code)) return
    if (visiting.has(code)) {
      const r = byCode.get(code)
      if (r) errors.push({ rowNo: r.rowNo, code, message: 'Circular parent reference in import file' })
      return
    }
    const row = byCode.get(code)
    if (!row) return
    visiting.add(code)
    if (row.parentAccountCode) {
      if (byCode.has(row.parentAccountCode)) {
        visit(row.parentAccountCode, [...stack, code])
      }
      // External parents (already in DB) are fine
    }
    visiting.delete(code)
    visited.add(code)
    order.push(row)
  }

  for (const r of rows) visit(r.accountCode, [])
  return { order, errors }
}

export async function importAccounts(
  tenantId: string,
  userId: string,
  payload: AccountImportPayload,
): Promise<AccountImportSummary> {
  const legalEntityId = payload.legalEntityId
  if (!legalEntityId) throw new ValidationError('legalEntityId is required')
  await getLegalEntityOrThrow(tenantId, legalEntityId)

  const duplicateMode: AccountImportDuplicateMode = payload.duplicateMode ?? 'skip'
  const summary: AccountImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  const parsed: ParsedRow[] = []
  const seenCodes = new Set<string>()

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const { parsed: p, errors } = parseRow(row, rowNo)
    if (errors.length || !p) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors })
      continue
    }
    if (seenCodes.has(p.accountCode)) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, code: p.accountCode, errors: ['Duplicate Account Code in file'] })
      continue
    }
    seenCodes.add(p.accountCode)
    parsed.push(p)
  }

  if (parsed.length === 0) return summary

  const { order, errors: topoErrors } = topologicalOrder(parsed)
  for (const e of topoErrors) {
    summary.failed += 1
    summary.rows.push({ row: e.rowNo, ok: false, code: e.code, errors: [e.message] })
  }
  const failedCodes = new Set(topoErrors.map((e) => e.code))
  const workable = order.filter((r) => !failedCodes.has(r.accountCode))

  // Preload existing accounts for this LE
  const existing = await prisma.account.findMany({
    where: { tenantId, legalEntityId },
    select: {
      id: true,
      accountCode: true,
      isGroup: true,
      category: true,
      level: true,
      parentAccountId: true,
    },
  })
  const codeToId = new Map(existing.map((a) => [a.accountCode, a.id]))
  const idToMeta = new Map(existing.map((a) => [a.id, a]))

  for (const row of workable) {
    try {
      let parentId: string | null = null
      let level = 1
      if (row.parentAccountCode) {
        parentId = codeToId.get(row.parentAccountCode) ?? null
        if (!parentId) {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: [`Parent account not found: ${row.parentAccountCode}`],
          })
          continue
        }
        const parentMeta = idToMeta.get(parentId) ?? (await prisma.account.findFirst({
          where: { id: parentId, tenantId },
          select: { id: true, isGroup: true, category: true, level: true },
        }))
        if (!parentMeta) {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: [`Parent account not found: ${row.parentAccountCode}`],
          })
          continue
        }
        if (!parentMeta.isGroup) {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: ['Parent must be a Group account'],
          })
          continue
        }
        if (parentMeta.category !== row.category) {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: ['Parent and child categories must match'],
          })
          continue
        }
        level = parentMeta.level + 1
        if (level > MAX_ACCOUNT_DEPTH) {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: [`Account depth exceeds maximum (${MAX_ACCOUNT_DEPTH})`],
          })
          continue
        }
      }

      const existingId = codeToId.get(row.accountCode)
      if (existingId) {
        if (duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: row.rowNo, ok: true, code: row.accountCode })
          continue
        }
        if (duplicateMode === 'reject') {
          summary.failed += 1
          summary.rows.push({
            row: row.rowNo,
            ok: false,
            code: row.accountCode,
            errors: ['Account code already exists'],
          })
          continue
        }
        // update
        const updated = await prisma.account.update({
          where: { id: existingId },
          data: {
            accountName: row.accountName,
            parentAccountId: parentId,
            category: row.category,
            accountType: row.accountType,
            level,
            isGroup: row.isGroup,
            isControlAccount: row.isControlAccount,
            allowManualPosting: row.allowManualPosting,
            normalBalance: row.normalBalance,
            isActive: row.isActive,
            updatedBy: userId,
          },
        })
        codeToId.set(updated.accountCode, updated.id)
        idToMeta.set(updated.id, {
          id: updated.id,
          accountCode: updated.accountCode,
          isGroup: updated.isGroup,
          category: updated.category,
          level: updated.level,
          parentAccountId: updated.parentAccountId,
        })
        summary.updated += 1
        summary.rows.push({ row: row.rowNo, ok: true, code: row.accountCode })
        continue
      }

      const created = await prisma.account.create({
        data: {
          tenantId,
          legalEntityId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          parentAccountId: parentId,
          category: row.category,
          accountType: row.accountType,
          level,
          isGroup: row.isGroup,
          isControlAccount: row.isControlAccount,
          allowManualPosting: row.allowManualPosting,
          normalBalance: row.normalBalance,
          isActive: row.isActive,
          requiresParty: ['CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE'].includes(row.accountType),
          requiresReconciliation: false,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      codeToId.set(created.accountCode, created.id)
      idToMeta.set(created.id, {
        id: created.id,
        accountCode: created.accountCode,
        isGroup: created.isGroup,
        category: created.category,
        level: created.level,
        parentAccountId: created.parentAccountId,
      })
      summary.imported += 1
      summary.rows.push({ row: row.rowNo, ok: true, code: row.accountCode })
    } catch (err) {
      const message =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
          ? 'Account code already exists'
          : err instanceof Error
            ? err.message
            : 'Import failed'
      if (err instanceof ConflictError) {
        summary.failed += 1
        summary.rows.push({ row: row.rowNo, ok: false, code: row.accountCode, errors: [err.message] })
        continue
      }
      summary.failed += 1
      summary.rows.push({ row: row.rowNo, ok: false, code: row.accountCode, errors: [message] })
    }
  }

  return summary
}
