import type { CustomerParty } from '../customer-party/customer-party.types.js'
import type {
  CalculationIssue,
  SalesInvoiceCalculationResult,
} from '../calculation/sales-invoice-calculation.types.js'

export interface AccountReadinessItem {
  mappingKey: string
  required: boolean
  configured: boolean
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  valid: boolean
  issues: CalculationIssue[]
}

export interface PeriodReadiness {
  resolved: boolean
  financialYearId: string | null
  periodId: string | null
  financialYearActive: boolean
  periodOpen: boolean
  issues: CalculationIssue[]
}

export interface CustomerReadiness {
  found: boolean
  active: boolean
  party: CustomerParty | null
  issues: CalculationIssue[]
}

export interface SalesInvoiceValidationPreview {
  valid: boolean
  calculation: SalesInvoiceCalculationResult
  customerReadiness: CustomerReadiness
  accountReadiness: AccountReadinessItem[]
  periodReadiness: PeriodReadiness | null
  errors: CalculationIssue[]
  warnings: CalculationIssue[]
}
