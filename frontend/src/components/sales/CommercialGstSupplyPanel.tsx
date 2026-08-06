/**
 * Shared GST supply chrome: auto Place of Supply, read-only supply type, authorised override.
 * Supplier (seller) state is always LE-sourced and non-editable in this panel.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { ErpFieldGroup, ErpFieldRow } from '../erp/card-form'
import { Input, Select, Textarea } from '../forms/Inputs'
import { SELECT_PLACEHOLDER } from '../forms/selectStandards'
import {
  formatPlaceOfSupplyLabel,
  listGstStateSelectOptions,
  resolveGstStateCode,
} from '../../utils/gstStateCode'
import {
  formatPlaceOfSupplySourceLabel,
  formatSupplyTypeLabel,
  formatTaxSchemeLabel,
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
  type CommercialPlaceOfSupplySource,
} from '../../utils/commercialSupplyContext'
import { canCrmPermission } from '../../utils/permissions/crm'
import { cn } from '../../utils/cn'

const GST_STATE_OPTIONS = listGstStateSelectOptions()
/** Path matches Finance settings nav (Accounting → Legal Entities). */
const LEGAL_ENTITIES_PATH = '/accounting/settings/legal-entities'

export type CommercialGstSupplyValue = {
  /** Effective place of supply state code (or label that resolves). */
  placeOfSupply: string
  placeOfSupplyOverride: boolean
  placeOfSupplyOverrideReason: string
  supplierStateCode: string
}

export type CommercialGstSupplyPanelProps = {
  value: CommercialGstSupplyValue
  onChange: (next: CommercialGstSupplyValue) => void
  customerState?: string | null
  customerGstin?: string | null
  shipToState?: string | null
  billToState?: string | null
  isServiceDocument?: boolean
  allowOverrideUi?: boolean
  className?: string
  columns?: 2 | 3 | 4
  readOnly?: boolean
}

export function CommercialGstSupplyPanel({
  value,
  onChange,
  customerState,
  customerGstin,
  shipToState,
  billToState,
  isServiceDocument,
  allowOverrideUi = true,
  className,
  columns = 3,
  readOnly = false,
}: CommercialGstSupplyPanelProps) {
  const canOverride = allowOverrideUi && canCrmPermission('crm.commercial.tax_place_override')

  const autoPos = useMemo(
    () =>
      resolveCommercialPlaceOfSupply({
        placeOfSupplyOverride: false,
        shipToState,
        billToState: billToState ?? customerState,
        customerState,
        customerGstin,
        isServiceDocument,
      }),
    [shipToState, billToState, customerState, customerGstin, isServiceDocument],
  )

  const effective = useMemo(() => {
    if (value.placeOfSupplyOverride && value.placeOfSupply) {
      return resolveCommercialPlaceOfSupply({
        placeOfSupplyOverride: true,
        placeOfSupplyOverrideValue: value.placeOfSupply,
        customerState,
        customerGstin,
      })
    }
    return autoPos
  }, [value.placeOfSupply, value.placeOfSupplyOverride, autoPos, customerState, customerGstin])

  const supply = useMemo(
    () =>
      resolveCommercialSupplyType({
        supplierStateCode: value.supplierStateCode,
        placeOfSupplyStateCode: effective.placeOfSupplyStateCode,
      }),
    [value.supplierStateCode, effective.placeOfSupplyStateCode],
  )

  /** Never accept supplierStateCode from panel UI — LE is the only source. */
  const patch = (partial: Partial<CommercialGstSupplyValue>) => {
    const { supplierStateCode: _ignore, ...rest } = partial
    onChange({ ...value, ...rest, supplierStateCode: value.supplierStateCode })
  }

  const posDisplay = value.placeOfSupplyOverride
    ? effective.placeOfSupplyLabel ||
      formatPlaceOfSupplyLabel(effective.placeOfSupplyStateCode) ||
      'Not resolved'
    : autoPos.placeOfSupplyLabel ||
      formatPlaceOfSupplyLabel(autoPos.placeOfSupplyStateCode) ||
      'Not resolved'

  const posSource: CommercialPlaceOfSupplySource = value.placeOfSupplyOverride
    ? 'OVERRIDE'
    : autoPos.source

  const hasSupplierState = Boolean(resolveGstStateCode(value.supplierStateCode))
  const supplierLabel = hasSupplierState
    ? formatPlaceOfSupplyLabel(value.supplierStateCode) || value.supplierStateCode
    : 'Not set on Legal Entity'

  return (
    <ErpFieldGroup
      label="GST supply"
      className={cn('commercial-gst-supply', className)}
      columns={columns}
    >
      <ErpFieldRow
        label="Supplier state"
        hint={
          hasSupplierState
            ? 'From your default Legal Entity GST registration — not the customer.'
            : undefined
        }
        readOnly
      >
        <Input
          value={supplierLabel}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          title="Set under Accounting → Legal Entities"
        />
      </ErpFieldRow>

      <ErpFieldRow
        label="Place of supply"
        hint={
          !effective.placeOfSupplyStateCode && !value.placeOfSupplyOverride
            ? 'Not resolved'
            : `Derived from: ${formatPlaceOfSupplySourceLabel(posSource)}`
        }
        readOnly={readOnly || (!canOverride && !value.placeOfSupplyOverride)}
      >
        {readOnly || (!canOverride && value.placeOfSupplyOverride) ? (
          <Input value={posDisplay} readOnly />
        ) : value.placeOfSupplyOverride && canOverride ? (
          <Select
            value={resolveGstStateCode(value.placeOfSupply) ?? value.placeOfSupply}
            onChange={(e) => patch({ placeOfSupply: e.target.value })}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {GST_STATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input value={posDisplay} readOnly />
        )}
      </ErpFieldRow>

      <ErpFieldRow label="Supply type" hint={formatTaxSchemeLabel(supply.taxScheme)} readOnly>
        <Input
          value={
            supply.supplyType === 'INTRA_STATE'
              ? supply.taxScheme === 'utgst_pair'
                ? 'Intra-state — CGST + UTGST'
                : 'Intra-state — CGST + SGST'
              : supply.supplyType === 'INTER_STATE'
                ? 'Inter-state — IGST'
                : 'Unresolved'
          }
          readOnly
          className="font-medium"
        />
      </ErpFieldRow>

      <div className="col-span-full rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[12px] text-erp-text">
        <div className="font-semibold text-erp-muted">Tax determination</div>
        <ul className="mt-1 space-y-0.5">
          <li>Supplier state: {supplierLabel}</li>
          <li>Place of Supply: {posDisplay}</li>
          <li>Supply type: {formatSupplyTypeLabel(supply.supplyType)}</li>
          <li>Tax applied: {formatTaxSchemeLabel(supply.taxScheme)}</li>
        </ul>
        {!hasSupplierState ? (
          <p className="mt-2 text-amber-800">
            Supplier state is missing. Set the Legal Entity GSTIN / state code under{' '}
            <Link className="font-medium underline" to={LEGAL_ENTITIES_PATH}>
              Accounting → Legal Entities
            </Link>
            , then reload this form. It cannot be typed here.
          </p>
        ) : null}
        {supply.unresolved ? (
          <p className="mt-2 text-amber-800">
            Place of Supply could not be determined. Complete the customer or delivery tax
            details before posting.
          </p>
        ) : null}
      </div>

      {canOverride && !readOnly ? (
        <ErpFieldRow
          label="Override place of supply"
          className={columns >= 3 ? 'col-span-full' : undefined}
          hint="Requires permission crm.commercial.tax_place_override"
        >
          <label className="flex items-center gap-2 text-[13px] text-erp-text">
            <input
              type="checkbox"
              checked={value.placeOfSupplyOverride}
              onChange={(e) => {
                const on = e.target.checked
                patch({
                  placeOfSupplyOverride: on,
                  placeOfSupply: on
                    ? resolveGstStateCode(value.placeOfSupply) ||
                      autoPos.placeOfSupplyStateCode ||
                      ''
                    : (autoPos.placeOfSupplyStateCode ?? ''),
                  placeOfSupplyOverrideReason: on ? value.placeOfSupplyOverrideReason : '',
                })
              }}
            />
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              Authorised override
            </span>
          </label>
        </ErpFieldRow>
      ) : null}

      {value.placeOfSupplyOverride && !readOnly ? (
        <ErpFieldRow
          label="Override reason"
          className="col-span-full"
          hint="Required for audit trail"
        >
          <Textarea
            rows={2}
            value={value.placeOfSupplyOverrideReason}
            onChange={(e) => patch({ placeOfSupplyOverrideReason: e.target.value })}
            placeholder="Why is Place of Supply different from auto resolution?"
          />
        </ErpFieldRow>
      ) : null}

      {!supply.unresolved && (supply.warnings.length > 0 || effective.warnings.length > 0) ? (
        <p className="col-span-full text-[12px] text-amber-700">
          {[...supply.warnings, ...effective.warnings].join(' · ')}
        </p>
      ) : null}
    </ErpFieldGroup>
  )
}

/** Read-only strip for detail / print contexts. */
export function CommercialGstSupplyReadOnly({
  supplierStateCode,
  placeOfSupply,
  placeOfSupplyStateCode,
  placeOfSupplySource,
  supplyType,
  gstScheme,
  placeOfSupplyOverride,
  placeOfSupplyOverrideReason,
}: {
  supplierStateCode?: string | null
  placeOfSupply?: string | null
  placeOfSupplyStateCode?: string | null
  placeOfSupplySource?: string | null
  supplyType?: string | null
  gstScheme?: string | null
  placeOfSupplyOverride?: boolean
  placeOfSupplyOverrideReason?: string | null
}) {
  const posLabel =
    placeOfSupply || formatPlaceOfSupplyLabel(placeOfSupplyStateCode) || 'Not resolved'
  return (
    <div className="commercial-gst-supply-readonly grid gap-2 rounded-md border border-erp-border bg-erp-surface-alt/40 px-3 py-2 text-[12px] sm:grid-cols-3">
      <div>
        <div className="text-erp-muted">Supplier state</div>
        <div className="font-medium text-erp-text">
          {formatPlaceOfSupplyLabel(supplierStateCode) || supplierStateCode || '—'}
        </div>
      </div>
      <div>
        <div className="text-erp-muted">
          Place of supply
          {placeOfSupplyOverride ? ' (override)' : ''}
        </div>
        <div className="font-medium text-erp-text">{posLabel}</div>
        {placeOfSupplySource ? (
          <div className="mt-0.5 text-[11px] text-erp-muted">
            Derived from:{' '}
            {formatPlaceOfSupplySourceLabel(
              placeOfSupplySource as CommercialPlaceOfSupplySource,
            )}
          </div>
        ) : null}
        {placeOfSupplyOverride && placeOfSupplyOverrideReason ? (
          <div className="mt-0.5 text-[11px] text-erp-muted">{placeOfSupplyOverrideReason}</div>
        ) : null}
      </div>
      <div>
        <div className="text-erp-muted">Supply type</div>
        <div className="font-medium text-erp-text">
          {supplyType === 'INTRA_STATE'
            ? gstScheme === 'utgst_pair'
              ? 'Intra-state — CGST + UTGST'
              : 'Intra-state — CGST + SGST'
            : supplyType === 'INTER_STATE'
              ? 'Inter-state — IGST'
              : supplyType || 'Unresolved'}
        </div>
      </div>
    </div>
  )
}
