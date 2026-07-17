import type { AccountCategory, AccountType, NormalBalance } from '@prisma/client'
import type { CoaTemplateId } from './finance.constants.js'
import { COA_TEMPLATE_LABELS } from './finance.constants.js'

export type DraftAccountNode = {
  accountCode: string
  accountName: string
  category: AccountCategory
  accountType: AccountType
  isGroup: boolean
  isControlAccount?: boolean
  allowManualPosting?: boolean
  normalBalance: NormalBalance
  requiresParty?: boolean
  requiresReconciliation?: boolean
  children?: DraftAccountNode[]
}

export type FlatDraftAccount = DraftAccountNode & {
  parentAccountCode?: string
  level: number
}

function flattenTree(nodes: DraftAccountNode[], parentCode?: string, level = 1): FlatDraftAccount[] {
  const out: FlatDraftAccount[] = []
  for (const node of nodes) {
    const { children, ...rest } = node
    out.push({ ...rest, parentAccountCode: parentCode, level })
    if (children?.length) {
      out.push(...flattenTree(children, node.accountCode, level + 1))
    }
  }
  return out
}

const BASE_TREE: DraftAccountNode[] = [
  {
    accountCode: '1000',
    accountName: 'Assets',
    category: 'ASSET',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'DEBIT',
    children: [
      {
        accountCode: '1100',
        accountName: 'Current Assets',
        category: 'ASSET',
        accountType: 'GENERAL',
        isGroup: true,
        normalBalance: 'DEBIT',
        children: [
          {
            accountCode: '110100',
            accountName: 'Cash',
            category: 'ASSET',
            accountType: 'CASH',
            isGroup: false,
            normalBalance: 'DEBIT',
          },
          {
            accountCode: '110200',
            accountName: 'Bank Accounts',
            category: 'ASSET',
            accountType: 'BANK',
            isGroup: true,
            normalBalance: 'DEBIT',
            children: [
              {
                accountCode: '110201',
                accountName: 'Primary Bank',
                category: 'ASSET',
                accountType: 'BANK',
                isGroup: false,
                requiresReconciliation: true,
                normalBalance: 'DEBIT',
              },
            ],
          },
          {
            accountCode: '110300',
            accountName: 'Accounts Receivable',
            category: 'ASSET',
            accountType: 'CUSTOMER_RECEIVABLE',
            isGroup: false,
            isControlAccount: true,
            allowManualPosting: false,
            requiresParty: true,
            normalBalance: 'DEBIT',
          },
        ],
      },
      {
        accountCode: '1200',
        accountName: 'Fixed Assets',
        category: 'ASSET',
        accountType: 'FIXED_ASSET',
        isGroup: true,
        normalBalance: 'DEBIT',
        children: [
          {
            accountCode: '120100',
            accountName: 'Plant & Machinery',
            category: 'ASSET',
            accountType: 'FIXED_ASSET',
            isGroup: false,
            normalBalance: 'DEBIT',
          },
          {
            accountCode: '120200',
            accountName: 'Accumulated Depreciation',
            category: 'ASSET',
            accountType: 'ACCUMULATED_DEPRECIATION',
            isGroup: false,
            normalBalance: 'CREDIT',
          },
        ],
      },
    ],
  },
  {
    accountCode: '2000',
    accountName: 'Liabilities',
    category: 'LIABILITY',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'CREDIT',
    children: [
      {
        accountCode: '2100',
        accountName: 'Accounts Payable',
        category: 'LIABILITY',
        accountType: 'VENDOR_PAYABLE',
        isGroup: false,
        isControlAccount: true,
        allowManualPosting: false,
        requiresParty: true,
        normalBalance: 'CREDIT',
      },
      {
        accountCode: '2200',
        accountName: 'GST Output',
        category: 'LIABILITY',
        accountType: 'GST_OUTPUT',
        isGroup: true,
        normalBalance: 'CREDIT',
        children: [
          { accountCode: '220101', accountName: 'CGST Output', category: 'LIABILITY', accountType: 'GST_OUTPUT', isGroup: false, normalBalance: 'CREDIT' },
          { accountCode: '220102', accountName: 'SGST Output', category: 'LIABILITY', accountType: 'GST_OUTPUT', isGroup: false, normalBalance: 'CREDIT' },
          { accountCode: '220103', accountName: 'IGST Output', category: 'LIABILITY', accountType: 'GST_OUTPUT', isGroup: false, normalBalance: 'CREDIT' },
        ],
      },
      {
        accountCode: '2300',
        accountName: 'TDS Payable',
        category: 'LIABILITY',
        accountType: 'TDS_PAYABLE',
        isGroup: false,
        normalBalance: 'CREDIT',
      },
    ],
  },
  {
    accountCode: '3000',
    accountName: 'Equity',
    category: 'EQUITY',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'CREDIT',
    children: [
      {
        accountCode: '3100',
        accountName: 'Retained Earnings',
        category: 'EQUITY',
        accountType: 'RETAINED_EARNINGS',
        isGroup: false,
        normalBalance: 'CREDIT',
      },
    ],
  },
  {
    accountCode: '4000',
    accountName: 'Income',
    category: 'INCOME',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'CREDIT',
    children: [
      {
        accountCode: '4100',
        accountName: 'Sales Revenue',
        category: 'INCOME',
        accountType: 'SALES',
        isGroup: false,
        normalBalance: 'CREDIT',
      },
      {
        accountCode: '4200',
        accountName: 'Sales Returns',
        category: 'INCOME',
        accountType: 'SALES_RETURN',
        isGroup: false,
        normalBalance: 'DEBIT',
      },
    ],
  },
  {
    accountCode: '5000',
    accountName: 'Expenses',
    category: 'EXPENSE',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'DEBIT',
    children: [
      {
        accountCode: '5100',
        accountName: 'Purchase',
        category: 'EXPENSE',
        accountType: 'PURCHASE',
        isGroup: false,
        normalBalance: 'DEBIT',
      },
      {
        accountCode: '5200',
        accountName: 'GST Input',
        category: 'EXPENSE',
        accountType: 'GST_INPUT',
        isGroup: true,
        normalBalance: 'DEBIT',
        children: [
          { accountCode: '520101', accountName: 'CGST Input', category: 'EXPENSE', accountType: 'GST_INPUT', isGroup: false, normalBalance: 'DEBIT' },
          { accountCode: '520102', accountName: 'SGST Input', category: 'EXPENSE', accountType: 'GST_INPUT', isGroup: false, normalBalance: 'DEBIT' },
          { accountCode: '520103', accountName: 'IGST Input', category: 'EXPENSE', accountType: 'GST_INPUT', isGroup: false, normalBalance: 'DEBIT' },
        ],
      },
      {
        accountCode: '5300',
        accountName: 'Bank Charges',
        category: 'EXPENSE',
        accountType: 'EXPENSE',
        isGroup: false,
        normalBalance: 'DEBIT',
      },
    ],
  },
]

const MANUFACTURING_EXTRA: DraftAccountNode[] = [
  {
    accountCode: '1300',
    accountName: 'Inventory',
    category: 'ASSET',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'DEBIT',
    children: [
      { accountCode: '130100', accountName: 'Raw Material', category: 'ASSET', accountType: 'RAW_MATERIAL_INVENTORY', isGroup: false, normalBalance: 'DEBIT' },
      { accountCode: '130200', accountName: 'Work In Progress', category: 'ASSET', accountType: 'WIP_INVENTORY', isGroup: false, normalBalance: 'DEBIT' },
      { accountCode: '130300', accountName: 'Finished Goods', category: 'ASSET', accountType: 'FINISHED_GOODS_INVENTORY', isGroup: false, normalBalance: 'DEBIT' },
    ],
  },
  {
    accountCode: '5400',
    accountName: 'Production Variance',
    category: 'EXPENSE',
    accountType: 'PRODUCTION_VARIANCE',
    isGroup: false,
    normalBalance: 'DEBIT',
  },
]

const TRADING_EXTRA: DraftAccountNode[] = [
  {
    accountCode: '1300',
    accountName: 'Inventory',
    category: 'ASSET',
    accountType: 'GENERAL',
    isGroup: true,
    normalBalance: 'DEBIT',
    children: [
      { accountCode: '130300', accountName: 'Trading Stock', category: 'ASSET', accountType: 'FINISHED_GOODS_INVENTORY', isGroup: false, normalBalance: 'DEBIT' },
    ],
  },
]

const SERVICE_EXTRA: DraftAccountNode[] = [
  {
    accountCode: '5400',
    accountName: 'Operating Expenses',
    category: 'EXPENSE',
    accountType: 'EXPENSE',
    isGroup: true,
    normalBalance: 'DEBIT',
    children: [
      { accountCode: '540100', accountName: 'Professional Fees', category: 'EXPENSE', accountType: 'EXPENSE', isGroup: false, normalBalance: 'DEBIT' },
    ],
  },
]

const JOB_WORK_EXTRA: DraftAccountNode[] = [
  ...MANUFACTURING_EXTRA,
  {
    accountCode: '5500',
    accountName: 'Subcontracting Expense',
    category: 'EXPENSE',
    accountType: 'EXPENSE',
    isGroup: false,
    normalBalance: 'DEBIT',
  },
]

function mergeTrees(base: DraftAccountNode[], extras: DraftAccountNode[]): DraftAccountNode[] {
  const assets = base.find((n) => n.accountCode === '1000')
  const expenses = base.find((n) => n.accountCode === '5000')
  if (assets && extras.some((e) => e.accountCode.startsWith('13'))) {
    assets.children = [...(assets.children ?? []), ...extras.filter((e) => e.accountCode.startsWith('13'))]
  }
  const expenseExtras = extras.filter((e) => !e.accountCode.startsWith('13'))
  if (expenses && expenseExtras.length) {
    expenses.children = [...(expenses.children ?? []), ...expenseExtras]
  }
  return base
}

export function getCoaTemplateTree(templateId: CoaTemplateId): DraftAccountNode[] {
  const base = structuredClone(BASE_TREE)
  switch (templateId) {
    case 'MANUFACTURING':
      return mergeTrees(base, structuredClone(MANUFACTURING_EXTRA))
    case 'TRADING':
      return mergeTrees(base, structuredClone(TRADING_EXTRA))
    case 'SERVICE':
      return mergeTrees(base, structuredClone(SERVICE_EXTRA))
    case 'JOB_WORK':
      return mergeTrees(base, structuredClone(JOB_WORK_EXTRA))
    default:
      return base
  }
}

export function flattenCoaTemplate(templateId: CoaTemplateId): FlatDraftAccount[] {
  return flattenTree(getCoaTemplateTree(templateId))
}

export function listCoaTemplates(): Array<{ id: CoaTemplateId; label: string; accountCount: number }> {
  return (['MANUFACTURING', 'TRADING', 'SERVICE', 'JOB_WORK'] as CoaTemplateId[]).map((id) => ({
    id,
    label: COA_TEMPLATE_LABELS[id],
    accountCount: flattenCoaTemplate(id).length,
  }))
}
