import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account,
  AccountTreeNode,
  AccountingPeriod,
  Branch,
  CoaTemplateId,
  CostCentre,
  CostCentreTreeNode,
  DefaultAccountMapping,
  DefaultAccountMappingKey,
  DefaultMappingValidationResult,
  FinanceApprovalRule,
  FinanceNumberSeries,
  FinanceSettings,
  FinancialYear,
  LegalEntity,
  RoundingMethod,
  SetupMissingItem,
  SetupStatus,
} from '../types/financeSetup'
import {
  MANDATORY_MAPPING_KEYS,
  REQUIRED_NUMBER_SERIES_TYPES,
} from '../types/financeSetup'

export const DEMO_LEGAL_ENTITY_ID = 'a1000001-0001-4001-8001-000000000001'
export const DEMO_BRANCH_ID = 'a1000002-0002-4002-8002-000000000002'
export const DEMO_FY_ID = 'a1000003-0003-4003-8003-000000000003'

const now = () => new Date().toISOString()

function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>()
  for (const a of accounts) map.set(a.id, { ...a, children: [] })
  const roots: AccountTreeNode[] = []
  for (const node of map.values()) {
    if (node.parentAccountId && map.has(node.parentAccountId)) {
      map.get(node.parentAccountId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: AccountTreeNode[]) => {
    nodes.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

function buildCostCentreTree(centres: CostCentre[]): CostCentreTreeNode[] {
  const map = new Map<string, CostCentreTreeNode>()
  for (const c of centres) map.set(c.id, { ...c, children: [] })
  const roots: CostCentreTreeNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function seedAccounts(): Account[] {
  const gAsset = 'acc-grp-asset'
  const gLiability = 'acc-grp-liability'
  const gEquity = 'acc-grp-equity'
  const gIncome = 'acc-grp-income'
  const gExpense = 'acc-grp-expense'
  const gCurrentAsset = 'acc-grp-current-asset'

  return [
    { id: gAsset, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '1000', accountName: 'Assets', parentAccountId: null, category: 'ASSET', accountType: 'GENERAL', level: 1, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'DEBIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: gCurrentAsset, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '1100', accountName: 'Current Assets', parentAccountId: gAsset, category: 'ASSET', accountType: 'GENERAL', level: 2, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'DEBIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: 'acc-receivable', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '1101', accountName: 'Trade Receivables', parentAccountId: gCurrentAsset, category: 'ASSET', accountType: 'CUSTOMER_RECEIVABLE', level: 3, isGroup: false, isControlAccount: true, allowManualPosting: false, normalBalance: 'DEBIT', requiresParty: true, requiresReconciliation: false, isActive: true },
    { id: 'acc-bank', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '1102', accountName: 'Bank Account — HDFC', parentAccountId: gCurrentAsset, category: 'ASSET', accountType: 'BANK', level: 3, isGroup: false, isControlAccount: false, allowManualPosting: true, normalBalance: 'DEBIT', requiresParty: false, requiresReconciliation: true, isActive: true },
    { id: gLiability, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '2000', accountName: 'Liabilities', parentAccountId: null, category: 'LIABILITY', accountType: 'GENERAL', level: 1, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'CREDIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: 'acc-payable', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '2101', accountName: 'Trade Payables', parentAccountId: gLiability, category: 'LIABILITY', accountType: 'VENDOR_PAYABLE', level: 2, isGroup: false, isControlAccount: true, allowManualPosting: false, normalBalance: 'CREDIT', requiresParty: true, requiresReconciliation: false, isActive: true },
    { id: gEquity, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '3000', accountName: 'Equity', parentAccountId: null, category: 'EQUITY', accountType: 'GENERAL', level: 1, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'CREDIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: 'acc-retained', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '3101', accountName: 'Retained Earnings', parentAccountId: gEquity, category: 'EQUITY', accountType: 'RETAINED_EARNINGS', level: 2, isGroup: false, isControlAccount: false, allowManualPosting: false, normalBalance: 'CREDIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: gIncome, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '4000', accountName: 'Income', parentAccountId: null, category: 'INCOME', accountType: 'GENERAL', level: 1, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'CREDIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: 'acc-sales', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '4101', accountName: 'Sales Revenue', parentAccountId: gIncome, category: 'INCOME', accountType: 'SALES', level: 2, isGroup: false, isControlAccount: false, allowManualPosting: true, normalBalance: 'CREDIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: gExpense, legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '5000', accountName: 'Expenses', parentAccountId: null, category: 'EXPENSE', accountType: 'GENERAL', level: 1, isGroup: true, isControlAccount: false, allowManualPosting: false, normalBalance: 'DEBIT', requiresParty: false, requiresReconciliation: false, isActive: true },
    { id: 'acc-purchase', legalEntityId: DEMO_LEGAL_ENTITY_ID, accountCode: '5101', accountName: 'Purchase', parentAccountId: gExpense, category: 'EXPENSE', accountType: 'PURCHASE', level: 2, isGroup: false, isControlAccount: false, allowManualPosting: true, normalBalance: 'DEBIT', requiresParty: false, requiresReconciliation: false, isActive: true },
  ]
}

function seedNumberSeries(): FinanceNumberSeries[] {
  return (['JOURNAL', 'RECEIPT', 'PAYMENT'] as const).map((documentType) => ({
    id: `ns-${documentType.toLowerCase()}`,
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    documentType,
    financialYearId: null,
    prefix: documentType === 'JOURNAL' ? 'JV/' : documentType === 'RECEIPT' ? 'RC/' : 'PY/',
    currentValue: 0,
    padLength: 6,
    resetEachYear: true,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  }))
}

function seedMappings(accounts: Account[]): DefaultAccountMapping[] {
  const find = (type: string) => accounts.find((a) => a.accountType === type && !a.isGroup)
  const receivable = find('CUSTOMER_RECEIVABLE')
  const payable = find('VENDOR_PAYABLE')
  const sales = find('SALES')
  const purchase = find('PURCHASE')
  const retained = find('RETAINED_EARNINGS')
  const partial: Array<{ key: DefaultAccountMappingKey; accountId?: string }> = [
    { key: 'CUSTOMER_RECEIVABLE', accountId: receivable?.id },
    { key: 'VENDOR_PAYABLE', accountId: payable?.id },
    { key: 'SALES_REVENUE', accountId: sales?.id },
    { key: 'PURCHASE', accountId: purchase?.id },
    { key: 'RETAINED_EARNINGS', accountId: retained?.id },
  ]
  return partial
    .filter((p): p is { key: DefaultAccountMappingKey; accountId: string } => Boolean(p.accountId))
    .map((p, i) => ({
      id: `map-${i}`,
      legalEntityId: DEMO_LEGAL_ENTITY_ID,
      mappingKey: p.key,
      accountId: p.accountId,
      isMandatory: MANDATORY_MAPPING_KEYS.includes(p.key),
    }))
}

function createSeedState() {
  const legalEntities: LegalEntity[] = [
    {
      id: DEMO_LEGAL_ENTITY_ID,
      code: 'VTPL',
      legalName: 'Vasant Trailers Private Limited',
      displayName: 'Vasant Trailers Pvt Ltd',
      entityType: 'PRIVATE_LIMITED',
      pan: 'AABCV1234F',
      gstin: '27AABCV1234F1Z5',
      baseCurrency: 'INR',
      countryCode: 'IN',
      stateCode: '27',
      fiscalYearStartMonth: 4,
      isDefault: true,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ]

  const branches: Branch[] = [
    {
      id: DEMO_BRANCH_ID,
      legalEntityId: DEMO_LEGAL_ENTITY_ID,
      code: 'HO',
      name: 'Head Office — Pune',
      branchType: 'HEAD_OFFICE',
      gstin: '27AABCV1234F1Z5',
      stateCode: '27',
      isHeadOffice: true,
      isDefault: true,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ]

  const financialYears: FinancialYear[] = [
    {
      id: DEMO_FY_ID,
      legalEntityId: DEMO_LEGAL_ENTITY_ID,
      name: 'FY 2025-26',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      status: 'DRAFT',
      isCurrent: false,
      createdAt: now(),
      updatedAt: now(),
    },
  ]

  const accounts = seedAccounts()
  const numberSeries = seedNumberSeries()

  return {
    selectedLegalEntityId: DEMO_LEGAL_ENTITY_ID,
    legalEntities,
    branches,
    financialYears,
    periods: [] as AccountingPeriod[],
    accounts,
    mappings: seedMappings(accounts),
    settings: {
      legalEntityId: DEMO_LEGAL_ENTITY_ID,
      baseCurrency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      amountPrecision: 2,
      quantityPrecision: 3,
      roundingMethod: 'ROUND_HALF_UP' as RoundingMethod,
      roundingTolerance: 1,
      allowBackdatedPosting: false,
      backdatedDaysLimit: 0,
      allowManualControlAccountPosting: false,
      financeActivated: false,
    } as FinanceSettings,
    costCentres: [
      {
        id: 'cc-production',
        legalEntityId: DEMO_LEGAL_ENTITY_ID,
        code: 'PROD',
        name: 'Production',
        parentId: null,
        isGroup: false,
        isActive: true,
      },
      {
        id: 'cc-admin',
        legalEntityId: DEMO_LEGAL_ENTITY_ID,
        code: 'ADMIN',
        name: 'Administration',
        parentId: null,
        isGroup: false,
        isActive: true,
      },
    ] as CostCentre[],
    numberSeries,
    approvalRules: [] as FinanceApprovalRule[],
  }
}

export function computeDemoSetupStatus(state: ReturnType<typeof createSeedState>, legalEntityId: string): SetupStatus {
  const missing: SetupMissingItem[] = []
  const entity = state.legalEntities.find((e) => e.id === legalEntityId)
  if (!entity?.isDefault || !entity.isActive) {
    missing.push({ key: 'DEFAULT_LEGAL_ENTITY', label: 'Default legal entity', count: 1, route: '/accounting/settings/legal-entities' })
  }
  const defaultBranch = state.branches.find((b) => b.legalEntityId === legalEntityId && b.isDefault && b.isActive)
  if (!defaultBranch) {
    missing.push({ key: 'DEFAULT_BRANCH', label: 'Default active branch', count: 1, route: '/accounting/settings/branches' })
  }
  const activeFy = state.financialYears.find((fy) => fy.legalEntityId === legalEntityId && fy.status === 'ACTIVE' && fy.isCurrent)
  if (!activeFy) {
    missing.push({ key: 'ACTIVE_FINANCIAL_YEAR', label: 'Active financial year', count: 1, route: '/accounting/settings/financial-years' })
  }
  const periodCount = activeFy
    ? state.periods.filter((p) => p.financialYearId === activeFy.id).length
    : 0
  if (periodCount === 0) {
    missing.push({ key: 'ACCOUNTING_PERIODS', label: 'Accounting periods', count: 12, route: '/accounting/settings/periods' })
  }
  const ledgerCount = state.accounts.filter((a) => a.legalEntityId === legalEntityId && a.isActive && !a.isGroup).length
  if (ledgerCount === 0) {
    missing.push({ key: 'CHART_OF_ACCOUNTS', label: 'Chart of Accounts', count: 1, route: '/accounting/settings/chart-of-accounts' })
  }
  const mappedKeys = new Set(state.mappings.filter((m) => m.legalEntityId === legalEntityId).map((m) => m.mappingKey))
  const missingMappings = MANDATORY_MAPPING_KEYS.filter((k) => !mappedKeys.has(k))
  if (missingMappings.length > 0) {
    missing.push({
      key: 'DEFAULT_ACCOUNT_MAPPING',
      label: 'Default account mappings',
      count: missingMappings.length,
      route: '/accounting/settings/default-mappings',
    })
  }
  const seriesTypes = new Set(
    state.numberSeries.filter((s) => s.legalEntityId === legalEntityId && s.isActive).map((s) => s.documentType),
  )
  const missingSeries = REQUIRED_NUMBER_SERIES_TYPES.filter((t) => !seriesTypes.has(t))
  if (missingSeries.length > 0) {
    missing.push({
      key: 'CODE_SERIES',
      label: 'Voucher number series',
      count: missingSeries.length,
      route: '/accounting/settings/number-series',
    })
  }
  if (state.settings.financeActivated) {
    return { ready: true, missing: [], financeActivated: true }
  }
  return { ready: missing.length === 0, missing, financeActivated: false }
}

type FinanceSetupState = ReturnType<typeof createSeedState> & {
  setSelectedLegalEntityId: (id: string) => void
  listLegalEntities: () => LegalEntity[]
  createLegalEntity: (input: Partial<LegalEntity> & { initialBranch?: Partial<Branch> }) => LegalEntity
  updateLegalEntity: (id: string, patch: Partial<LegalEntity>) => LegalEntity
  setDefaultLegalEntity: (id: string) => LegalEntity
  activateLegalEntity: (id: string) => LegalEntity
  deactivateLegalEntity: (id: string) => LegalEntity
  listBranches: (legalEntityId: string) => Branch[]
  createBranch: (legalEntityId: string, input: Partial<Branch>) => Branch
  updateBranch: (id: string, patch: Partial<Branch>) => Branch
  setDefaultBranch: (id: string) => Branch
  activateBranch: (id: string) => Branch
  deactivateBranch: (id: string) => Branch
  listFinancialYears: (legalEntityId: string) => FinancialYear[]
  createFinancialYear: (input: Omit<FinancialYear, 'id' | 'status' | 'isCurrent'>) => FinancialYear
  updateFinancialYear: (id: string, patch: Partial<FinancialYear>) => FinancialYear
  activateFinancialYear: (id: string) => FinancialYear
  closeFinancialYear: (id: string) => FinancialYear
  listPeriods: (legalEntityId: string, financialYearId?: string) => AccountingPeriod[]
  generatePeriods: (legalEntityId: string, financialYearId: string) => AccountingPeriod[]
  updatePeriod: (id: string, patch: Partial<AccountingPeriod>) => AccountingPeriod
  markPeriodUnderReview: (id: string) => AccountingPeriod
  closePeriod: (id: string) => AccountingPeriod
  reopenPeriod: (id: string, reason: string) => AccountingPeriod
  listAccounts: (legalEntityId: string) => Account[]
  getAccountTree: (legalEntityId: string, includeInactive?: boolean) => AccountTreeNode[]
  createAccount: (input: Omit<Account, 'id'>) => Account
  updateAccount: (id: string, patch: Partial<Account>) => Account
  activateAccount: (id: string) => Account
  deactivateAccount: (id: string) => Account
  applyCoaTemplate: (legalEntityId: string, templateId: CoaTemplateId) => { applied: number }
  getDefaultMappings: (legalEntityId: string) => DefaultAccountMapping[]
  saveDefaultMappings: (
    legalEntityId: string,
    mappings: Array<{ mappingKey: DefaultAccountMappingKey; accountId: string }>,
  ) => DefaultAccountMapping[]
  validateDefaultMappings: (legalEntityId: string) => DefaultMappingValidationResult
  getFinanceSettings: (legalEntityId: string) => FinanceSettings
  saveFinanceSettings: (legalEntityId: string, patch: Partial<FinanceSettings>) => FinanceSettings
  getSetupStatus: (legalEntityId: string) => SetupStatus
  activateFinance: (legalEntityId: string) => FinanceSettings
  listCostCentres: (legalEntityId: string) => CostCentre[]
  getCostCentreTree: (legalEntityId: string) => CostCentreTreeNode[]
  createCostCentre: (input: Omit<CostCentre, 'id'>) => CostCentre
  updateCostCentre: (id: string, patch: Partial<CostCentre>) => CostCentre
  activateCostCentre: (id: string) => CostCentre
  deactivateCostCentre: (id: string) => CostCentre
  listNumberSeries: (legalEntityId: string) => FinanceNumberSeries[]
  upsertNumberSeries: (input: Omit<FinanceNumberSeries, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => FinanceNumberSeries
  listApprovalRules: (legalEntityId: string) => FinanceApprovalRule[]
  createApprovalRule: (input: Omit<FinanceApprovalRule, 'id'>) => FinanceApprovalRule
  updateApprovalRule: (id: string, patch: Partial<FinanceApprovalRule>) => FinanceApprovalRule
}

export const useFinanceSetupStore = create<FinanceSetupState>()(
  persist(
    (set, get) => ({
      ...createSeedState(),

      setSelectedLegalEntityId: (id) => set({ selectedLegalEntityId: id }),

      listLegalEntities: () => get().legalEntities,

      createLegalEntity: (input: Partial<LegalEntity> & { initialBranch?: Partial<Branch> }) => {
        const { initialBranch, ...entityInput } = input
        const id = crypto.randomUUID()
        const entity: LegalEntity = {
          id,
          code: entityInput.code ?? 'NEW',
          legalName: entityInput.legalName ?? 'New Company',
          displayName: entityInput.displayName ?? entityInput.legalName ?? 'New Company',
          entityType: entityInput.entityType ?? 'PRIVATE_LIMITED',
          baseCurrency: entityInput.baseCurrency ?? 'INR',
          countryCode: entityInput.countryCode ?? 'IN',
          fiscalYearStartMonth: entityInput.fiscalYearStartMonth ?? 4,
          isDefault: entityInput.isDefault ?? get().legalEntities.length === 0,
          isActive: true,
          pan: entityInput.pan,
          cin: entityInput.cin,
          gstin: entityInput.gstin,
          stateCode: entityInput.stateCode,
          registeredAddressJson: entityInput.registeredAddressJson,
          billingAddressJson: entityInput.billingAddressJson,
          createdAt: now(),
          updatedAt: now(),
        }
        const branches = [...get().branches]
        if (initialBranch) {
          branches.push({
            id: crypto.randomUUID(),
            legalEntityId: id,
            code: initialBranch.code ?? 'HO',
            name: initialBranch.name ?? 'Head Office',
            branchType: initialBranch.branchType ?? 'HEAD_OFFICE',
            isHeadOffice: true,
            isDefault: true,
            isActive: true,
            gstin: initialBranch.gstin,
            stateCode: initialBranch.stateCode,
            phone: initialBranch.phone,
            email: initialBranch.email,
            addressJson: initialBranch.addressJson,
            createdAt: now(),
            updatedAt: now(),
          })
        }
        if (entity.isDefault) {
          set({
            legalEntities: [...get().legalEntities.map((e) => ({ ...e, isDefault: false })), entity],
            branches,
          })
        } else {
          set({ legalEntities: [...get().legalEntities, entity], branches })
        }
        return entity
      },

      updateLegalEntity: (id, patch) => {
        let updated: LegalEntity | undefined
        set({
          legalEntities: get().legalEntities.map((e) => {
            if (e.id !== id) return e
            updated = { ...e, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Legal entity not found')
        return updated
      },

      setDefaultLegalEntity: (id) => {
        let updated: LegalEntity | undefined
        set({
          selectedLegalEntityId: id,
          legalEntities: get().legalEntities.map((e) => {
            const next = { ...e, isDefault: e.id === id, updatedAt: now() }
            if (e.id === id) updated = next
            return next
          }),
        })
        if (!updated) throw new Error('Legal entity not found')
        return updated
      },

      activateLegalEntity: (id) => get().updateLegalEntity(id, { isActive: true }),
      deactivateLegalEntity: (id) => get().updateLegalEntity(id, { isActive: false, isDefault: false }),

      listBranches: (legalEntityId) => get().branches.filter((b) => b.legalEntityId === legalEntityId),

      createBranch: (legalEntityId, input) => {
        const branch: Branch = {
          id: crypto.randomUUID(),
          legalEntityId,
          code: input.code ?? 'BR',
          name: input.name ?? 'Branch',
          branchType: input.branchType ?? 'OTHER',
          isHeadOffice: input.isHeadOffice ?? false,
          isDefault: input.isDefault ?? false,
          isActive: true,
          createdAt: now(),
          updatedAt: now(),
          ...input,
        }
        set({ branches: [...get().branches, branch] })
        return branch
      },

      updateBranch: (id, patch) => {
        let updated: Branch | undefined
        set({
          branches: get().branches.map((b) => {
            if (b.id !== id) return b
            updated = { ...b, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Branch not found')
        return updated
      },

      setDefaultBranch: (id) => {
        const branch = get().branches.find((b) => b.id === id)
        if (!branch) throw new Error('Branch not found')
        set({
          branches: get().branches.map((b) =>
            b.legalEntityId === branch.legalEntityId
              ? { ...b, isDefault: b.id === id, updatedAt: now() }
              : b,
          ),
        })
        return { ...branch, isDefault: true }
      },

      activateBranch: (id) => get().updateBranch(id, { isActive: true }),
      deactivateBranch: (id) => get().updateBranch(id, { isActive: false, isDefault: false }),

      listFinancialYears: (legalEntityId) => get().financialYears.filter((fy) => fy.legalEntityId === legalEntityId),

      createFinancialYear: (input) => {
        const fy: FinancialYear = {
          ...input,
          id: crypto.randomUUID(),
          status: 'DRAFT',
          isCurrent: false,
          createdAt: now(),
          updatedAt: now(),
        }
        set({ financialYears: [...get().financialYears, fy] })
        return fy
      },

      updateFinancialYear: (id, patch) => {
        let updated: FinancialYear | undefined
        set({
          financialYears: get().financialYears.map((fy) => {
            if (fy.id !== id) return fy
            updated = { ...fy, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Financial year not found')
        return updated
      },

      activateFinancialYear: (id) => {
        const fy = get().financialYears.find((f) => f.id === id)
        if (!fy) throw new Error('Financial year not found')
        set({
          financialYears: get().financialYears.map((f) =>
            f.legalEntityId === fy.legalEntityId
              ? {
                  ...f,
                  status: f.id === id ? 'ACTIVE' : f.status === 'ACTIVE' ? 'CLOSED' : f.status,
                  isCurrent: f.id === id,
                  updatedAt: now(),
                }
              : f,
          ),
        })
        return get().financialYears.find((f) => f.id === id)!
      },

      closeFinancialYear: (id) => get().updateFinancialYear(id, { status: 'CLOSED', isCurrent: false }),

      listPeriods: (legalEntityId, financialYearId) => {
        let periods = get().periods.filter((p) => p.legalEntityId === legalEntityId)
        if (financialYearId) periods = periods.filter((p) => p.financialYearId === financialYearId)
        return periods.sort((a, b) => a.periodNumber - b.periodNumber)
      },

      generatePeriods: (legalEntityId, financialYearId) => {
        const fy = get().financialYears.find((f) => f.id === financialYearId)
        if (!fy) throw new Error('Financial year not found')
        const start = new Date(fy.startDate)
        const periods: AccountingPeriod[] = []
        for (let i = 0; i < 12; i += 1) {
          const pStart = new Date(start.getFullYear(), start.getMonth() + i, 1)
          const pEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0)
          periods.push({
            id: crypto.randomUUID(),
            legalEntityId,
            financialYearId,
            periodNumber: i + 1,
            name: pStart.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
            startDate: pStart.toISOString().slice(0, 10),
            endDate: pEnd.toISOString().slice(0, 10),
            status: 'OPEN',
            createdAt: now(),
            updatedAt: now(),
          })
        }
        set({
          periods: [
            ...get().periods.filter((p) => p.financialYearId !== financialYearId),
            ...periods,
          ],
        })
        return periods
      },

      updatePeriod: (id, patch) => {
        let updated: AccountingPeriod | undefined
        set({
          periods: get().periods.map((p) => {
            if (p.id !== id) return p
            updated = { ...p, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Period not found')
        return updated
      },

      markPeriodUnderReview: (id) => get().updatePeriod(id, { status: 'UNDER_REVIEW' }),
      closePeriod: (id) => get().updatePeriod(id, { status: 'CLOSED', closedAt: now() }),
      reopenPeriod: (id, reason) =>
        get().updatePeriod(id, { status: 'REOPENED', reopenedAt: now(), reopenReason: reason }),

      listAccounts: (legalEntityId) => get().accounts.filter((a) => a.legalEntityId === legalEntityId),

      getAccountTree: (legalEntityId, includeInactive = false) => {
        let accounts = get().accounts.filter((a) => a.legalEntityId === legalEntityId)
        if (!includeInactive) accounts = accounts.filter((a) => a.isActive)
        return buildAccountTree(accounts)
      },

      createAccount: (input) => {
        const account: Account = { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }
        set({ accounts: [...get().accounts, account] })
        return account
      },

      updateAccount: (id, patch) => {
        let updated: Account | undefined
        set({
          accounts: get().accounts.map((a) => {
            if (a.id !== id) return a
            updated = { ...a, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Account not found')
        return updated
      },

      activateAccount: (id) => get().updateAccount(id, { isActive: true }),
      deactivateAccount: (id) => get().updateAccount(id, { isActive: false }),

      applyCoaTemplate: (legalEntityId, _templateId) => {
        const existing = get().accounts.filter((a) => a.legalEntityId === legalEntityId).length
        if (existing > 0) return { applied: 0 }
        const seeded = seedAccounts().map((a) => ({ ...a, legalEntityId, id: crypto.randomUUID() }))
        set({ accounts: [...get().accounts, ...seeded] })
        return { applied: seeded.length }
      },

      getDefaultMappings: (legalEntityId) => get().mappings.filter((m) => m.legalEntityId === legalEntityId),

      saveDefaultMappings: (legalEntityId, rows) => {
        const others = get().mappings.filter((m) => m.legalEntityId !== legalEntityId)
        const mappings = rows.map((r) => ({
          id: `map-${legalEntityId}-${r.mappingKey}`,
          legalEntityId,
          mappingKey: r.mappingKey,
          accountId: r.accountId,
          isMandatory: MANDATORY_MAPPING_KEYS.includes(r.mappingKey),
        }))
        set({ mappings: [...others, ...mappings] })
        return mappings
      },

      validateDefaultMappings: (legalEntityId) => {
        const mapped = new Set(get().getDefaultMappings(legalEntityId).map((m) => m.mappingKey))
        const errors = MANDATORY_MAPPING_KEYS.filter((k) => !mapped.has(k)).map((mappingKey) => ({
          mappingKey,
          message: 'Mandatory mapping is missing',
        }))
        return { valid: errors.length === 0, errors, warnings: [] }
      },

      getFinanceSettings: (legalEntityId) => ({ ...get().settings, legalEntityId }),

      saveFinanceSettings: (legalEntityId, patch) => {
        const settings = { ...get().settings, ...patch, legalEntityId, updatedAt: now() }
        set({ settings })
        return settings
      },

      getSetupStatus: (legalEntityId) => computeDemoSetupStatus(get(), legalEntityId),

      activateFinance: (legalEntityId) => {
        const status = get().getSetupStatus(legalEntityId)
        if (!status.ready) throw new Error('Finance setup is incomplete.')
        const settings = {
          ...get().settings,
          legalEntityId,
          financeActivated: true,
          activatedAt: now(),
        }
        set({ settings })
        return settings
      },

      listCostCentres: (legalEntityId) => get().costCentres.filter((c) => c.legalEntityId === legalEntityId),

      getCostCentreTree: (legalEntityId) => buildCostCentreTree(get().listCostCentres(legalEntityId)),

      createCostCentre: (input) => {
        const cc: CostCentre = { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }
        set({ costCentres: [...get().costCentres, cc] })
        return cc
      },

      updateCostCentre: (id, patch) => {
        let updated: CostCentre | undefined
        set({
          costCentres: get().costCentres.map((c) => {
            if (c.id !== id) return c
            updated = { ...c, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Cost centre not found')
        return updated
      },

      activateCostCentre: (id) => get().updateCostCentre(id, { isActive: true }),
      deactivateCostCentre: (id) => get().updateCostCentre(id, { isActive: false }),

      listNumberSeries: (legalEntityId) => get().numberSeries.filter((s) => s.legalEntityId === legalEntityId),

      upsertNumberSeries: (input) => {
        const existing = get().numberSeries.find(
          (s) => s.legalEntityId === input.legalEntityId && s.documentType === input.documentType,
        )
        if (existing) {
          const updated = { ...existing, ...input, updatedAt: now() }
          set({
            numberSeries: get().numberSeries.map((s) => (s.id === existing.id ? updated : s)),
          })
          return updated
        }
        const created: FinanceNumberSeries = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now(),
          updatedAt: now(),
        }
        set({ numberSeries: [...get().numberSeries, created] })
        return created
      },

      listApprovalRules: (legalEntityId) => get().approvalRules.filter((r) => r.legalEntityId === legalEntityId),

      createApprovalRule: (input) => {
        const rule: FinanceApprovalRule = { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }
        set({ approvalRules: [...get().approvalRules, rule] })
        return rule
      },

      updateApprovalRule: (id, patch) => {
        let updated: FinanceApprovalRule | undefined
        set({
          approvalRules: get().approvalRules.map((r) => {
            if (r.id !== id) return r
            updated = { ...r, ...patch, updatedAt: now() }
            return updated
          }),
        })
        if (!updated) throw new Error('Approval rule not found')
        return updated
      },
    }),
    { name: 'fos-finance-setup-demo' },
  ),
)

export function getFinanceSetupStoreState() {
  return useFinanceSetupStore.getState()
}
