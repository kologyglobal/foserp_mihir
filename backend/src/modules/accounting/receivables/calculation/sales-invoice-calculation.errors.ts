import type { CalculationIssue } from './sales-invoice-calculation.types.js'

export class SalesInvoiceCalculationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'SalesInvoiceCalculationError'
  }

  toIssue(): CalculationIssue {
    return { code: this.code, message: this.message, field: this.field, severity: 'error' }
  }
}

export function calcError(code: string, message: string, field?: string): CalculationIssue {
  return { code, message, field, severity: 'error' }
}

export function calcWarning(code: string, message: string, field?: string): CalculationIssue {
  return { code, message, field, severity: 'warning' }
}
