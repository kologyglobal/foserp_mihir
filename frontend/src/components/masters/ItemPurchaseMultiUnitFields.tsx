import { FormField } from '../forms/FormField'
import { Input } from '../forms/Inputs'
import { UomMasterSelect } from './TaxMasterSelects'

type Props = {
  baseUomCode: string
  purchaseUomId: string
  purchaseUomCode: string
  uomConversionFactor: number
  onPurchaseUomChange: (uomId: string) => void
  onConversionFactorChange: (value: number) => void
  conversionError?: string
}

/** Item Master — vendor UOM vs stock UOM for PO / GRN multi-unit conversion. */
export function ItemPurchaseMultiUnitFields({
  baseUomCode,
  purchaseUomId,
  purchaseUomCode,
  uomConversionFactor,
  onPurchaseUomChange,
  onConversionFactorChange,
  conversionError,
}: Props) {
  const dualUom = Boolean(purchaseUomId && baseUomCode !== '—' && purchaseUomCode && purchaseUomCode !== baseUomCode)
  const factor = uomConversionFactor > 0 ? uomConversionFactor : 1

  return (
    <div className="md:col-span-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
      <p className="mb-1 text-[12px] font-semibold text-erp-text">Multi-unit purchase (vendor → stock)</p>
      <p className="mb-3 text-[11px] text-erp-muted">
        Used on purchase orders and GRNs when vendors quote in a different unit than inventory (e.g. MTR vs NOS).
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Stock / base UOM">
          <Input readOnly value={baseUomCode} className="font-mono uppercase" />
          <p className="mt-1 text-xs text-erp-muted">Set under General → Unit of Measure.</p>
        </FormField>
        <FormField label="Purchase / vendor UOM">
          <UomMasterSelect value={purchaseUomId} onChange={onPurchaseUomChange} />
          <p className="mt-1 text-xs text-erp-muted">Default unit on PO and GRN lines.</p>
        </FormField>
        <FormField label="UOM conversion factor" error={conversionError}>
          <Input
            type="number"
            step="0.001"
            min={0.001}
            value={dualUom ? uomConversionFactor : 1}
            disabled={!dualUom}
            onChange={(e) => onConversionFactorChange(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-erp-muted">
            Vendor units per 1 stock unit. Use 1 when purchase UOM equals base UOM.
          </p>
        </FormField>
      </div>
      {dualUom ? (
        <p className="mt-3 rounded-md border border-erp-primary/20 bg-erp-primary-soft/30 px-3 py-2 text-[11px] font-medium text-erp-text">
          {factor} {purchaseUomCode} = 1 {baseUomCode}
          {' · '}
          Example: 30 {purchaseUomCode} → {(30 / factor).toLocaleString(undefined, { maximumFractionDigits: 4 })} {baseUomCode} stock
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-erp-muted">
          Single-unit item — choose a purchase UOM different from stock UOM to enable conversion on purchase documents.
        </p>
      )}
    </div>
  )
}
