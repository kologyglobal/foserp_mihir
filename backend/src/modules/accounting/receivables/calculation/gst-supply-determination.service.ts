import type { SalesInvoiceSupplyType, SalesInvoiceTaxTreatment } from '../sales-invoices/sales-invoice.types.js'
import type { CalculationIssue } from './sales-invoice-calculation.types.js'
import { calcError } from './sales-invoice-calculation.errors.js'
import { normalizeStateCode } from '../validation/state-code.validator.js'

function supplyFromTaxTreatment(taxTreatment: SalesInvoiceTaxTreatment): SalesInvoiceSupplyType | null {
  switch (taxTreatment) {
    case 'EXPORT_WITH_TAX':
    case 'EXPORT_WITHOUT_TAX':
      return 'EXPORT'
    case 'SEZ_WITH_TAX':
    case 'SEZ_WITHOUT_TAX':
      return 'SEZ'
    case 'NON_GST':
      return 'NON_GST'
    default:
      return null
  }
}

function supplyFromStates(
  legalEntityStateCode: string | null | undefined,
  placeOfSupply: string | null | undefined,
): SalesInvoiceSupplyType | null {
  const leState = normalizeStateCode(legalEntityStateCode)
  const pos = normalizeStateCode(placeOfSupply)
  if (!leState || !pos) return null
  return leState === pos ? 'INTRA_STATE' : 'INTER_STATE'
}

export function isZeroGstSupply(supplyType: SalesInvoiceSupplyType, taxTreatment: SalesInvoiceTaxTreatment): boolean {
  if (supplyType === 'NON_GST') return true
  if (taxTreatment === 'NON_GST') return true
  if (taxTreatment === 'EXPORT_WITHOUT_TAX' || taxTreatment === 'SEZ_WITHOUT_TAX') return true
  return false
}

export interface SupplyDeterminationResult {
  derivedSupplyType: SalesInvoiceSupplyType
  supplyType: SalesInvoiceSupplyType
  errors: CalculationIssue[]
}

export function determineSupplyType(
  taxTreatment: SalesInvoiceTaxTreatment,
  legalEntityStateCode: string | null | undefined,
  placeOfSupply: string | null | undefined,
  manualSupplyType?: SalesInvoiceSupplyType,
): SupplyDeterminationResult {
  const errors: CalculationIssue[] = []
  const fromTreatment = supplyFromTaxTreatment(taxTreatment)
  const fromStates = supplyFromStates(legalEntityStateCode, placeOfSupply)

  let derived: SalesInvoiceSupplyType
  if (fromTreatment) {
    derived = fromTreatment
  } else if (fromStates) {
    derived = fromStates
  } else {
    derived = manualSupplyType ?? 'INTRA_STATE'
    if (!fromStates) {
      errors.push(
        calcError(
          'PLACE_OF_SUPPLY_REQUIRED',
          'Place of supply and legal entity state code are required to determine supply type',
          'placeOfSupply',
        ),
      )
    }
  }

  const supplyType = manualSupplyType ?? derived
  if (manualSupplyType && manualSupplyType !== derived) {
    errors.push(
      calcError(
        'SUPPLY_TYPE_MISMATCH',
        `Manual supply type ${manualSupplyType} conflicts with derived supply type ${derived}`,
        'supplyType',
      ),
    )
  }

  return { derivedSupplyType: derived, supplyType, errors }
}
