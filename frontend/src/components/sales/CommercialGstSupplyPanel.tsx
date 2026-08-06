/**
 * Shared GST supply chrome: auto Place of Supply, read-only supply type, authorised override.
 * Supplier (seller) state is always LE-sourced and non-editable in this panel.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Select, Textarea } from '../forms/Inputs'
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
  type CommercialSupplyType,
  type CommercialGstScheme,
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
  /** @deprecated Layout is fixed 3 tiles; kept for call-site compatibility. */
  columns?: 2 | 3 | 4
  readOnly?: boolean
}

/** Compact helper under Place of Supply tile. */
function shortPosSourceHint(source: CommercialPlaceOfSupplySource): string {
  switch (source) {
    case 'SHIP_TO':
      return 'From ship-to'
    case 'BILL_TO':
      return 'From bill-to'
    case 'CUSTOMER':
      return 'From customer state'
    case 'CUSTOMER_GSTIN':
      return 'From customer GSTIN'
    case 'OVERRIDE':
      return 'Authorised override'
    case 'UNRESOLVED':
      return 'Not resolved'
    default:
      return 'Auto'
  }
}

function supplyTypeChipClass(supplyType: CommercialSupplyType): string {
  if (supplyType === 'INTRA_STATE') return 'commercial-gst-supply__chip--intra'
  if (supplyType === 'INTER_STATE') return 'commercial-gst-supply__chip--inter'
  return 'commercial-gst-supply__chip--unresolved'
}

function supplyTypeDisplay(
  supplyType: CommercialSupplyType,
  taxScheme: CommercialGstScheme | string,
): { primary: string; scheme: string } {
  if (supplyType === 'INTRA_STATE') {
    return {
      primary: 'Intra-state',
      scheme:
        taxScheme === 'utgst_pair' || taxScheme === 'cgst_utgst'
          ? 'CGST + UTGST'
          : 'CGST + SGST',
    }
  }
  if (supplyType === 'INTER_STATE') {
    return { primary: 'Inter-state', scheme: 'IGST' }
  }
  return { primary: 'Unresolved', scheme: '—' }
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
  columns: _columns = 3,
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

  const posEditable = !readOnly && value.placeOfSupplyOverride && canOverride
  const supplyDisplay = supplyTypeDisplay(supply.supplyType, supply.taxScheme)
  const posHint =
    !effective.placeOfSupplyStateCode && !value.placeOfSupplyOverride
      ? 'Not resolved'
      : shortPosSourceHint(posSource)

  return (
    <section
      className={cn('commercial-gst-supply', className)}
      aria-label="GST supply"
    >
      <header className="commercial-gst-supply__head">
        <h3 className="commercial-gst-supply__title">GST supply</h3>
      </header>

      <div className="commercial-gst-supply__tiles" role="group" aria-label="GST supply summary">
        {/* Supplier state — LE only */}
        <div className="commercial-gst-supply__tile">
          <div className="commercial-gst-supply__tile-label">Supplier state</div>
          <div
            className={cn(
              'commercial-gst-supply__tile-value',
              !hasSupplierState && 'commercial-gst-supply__tile-value--warn',
            )}
            title="Set under Accounting → Legal Entities"
          >
            {supplierLabel}
          </div>
          <div className="commercial-gst-supply__tile-hint">From default Legal Entity</div>
        </div>

        {/* Place of supply */}
        <div className="commercial-gst-supply__tile">
          <div className="commercial-gst-supply__tile-label">Place of supply</div>
          {posEditable ? (
            <div className="commercial-gst-supply__tile-control">
              <Select
                value={resolveGstStateCode(value.placeOfSupply) ?? value.placeOfSupply}
                onChange={(e) => patch({ placeOfSupply: e.target.value })}
                aria-label="Place of supply"
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {GST_STATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div
              className={cn(
                'commercial-gst-supply__tile-value',
                !effective.placeOfSupplyStateCode && 'commercial-gst-supply__tile-value--warn',
              )}
              aria-readonly="true"
            >
              {posDisplay}
            </div>
          )}
          <div className="commercial-gst-supply__tile-hint">{posHint}</div>
        </div>

        {/* Supply type — display only */}
        <div className="commercial-gst-supply__tile commercial-gst-supply__tile--type">
          <div className="commercial-gst-supply__tile-label">Supply type</div>
          <div
            className="commercial-gst-supply__type-row"
            aria-readonly="true"
            title={formatTaxSchemeLabel(supply.taxScheme)}
          >
            <span
              className={cn(
                'commercial-gst-supply__chip',
                supplyTypeChipClass(supply.supplyType),
              )}
            >
              {supplyDisplay.primary}
            </span>
            {supply.supplyType !== 'UNRESOLVED' ? (
              <span className="commercial-gst-supply__scheme">{supplyDisplay.scheme}</span>
            ) : null}
          </div>
          <div className="commercial-gst-supply__tile-hint">
            {supply.supplyType === 'UNRESOLVED'
              ? 'Needs supplier & place of supply'
              : 'Tax scheme from state match'}
          </div>
        </div>
      </div>

      {/* Single determination strip — does not re-list the three fields */}
      <div className="commercial-gst-supply__strip" aria-label="Tax determination">
        <span className="commercial-gst-supply__strip-label">Tax applied</span>
        <span
          className={cn(
            'commercial-gst-supply__chip commercial-gst-supply__chip--sm',
            supplyTypeChipClass(supply.supplyType),
          )}
        >
          {formatTaxSchemeLabel(supply.taxScheme)}
        </span>
        <span className="commercial-gst-supply__strip-sep" aria-hidden="true">
          ·
        </span>
        <span className="commercial-gst-supply__strip-meta">
          {formatSupplyTypeLabel(supply.supplyType)}
        </span>
        {value.placeOfSupplyOverride ? (
          <>
            <span className="commercial-gst-supply__strip-sep" aria-hidden="true">
              ·
            </span>
            <span className="commercial-gst-supply__strip-meta commercial-gst-supply__strip-meta--override">
              PoS override on
            </span>
          </>
        ) : null}
      </div>

      {!hasSupplierState ? (
        <p className="commercial-gst-supply__alert" role="status">
          Supplier state is missing. Set the Legal Entity GSTIN / state code under{' '}
          <Link className="commercial-gst-supply__link" to={LEGAL_ENTITIES_PATH}>
            Accounting → Legal Entities
          </Link>
          , then reload this form. It cannot be typed here.
        </p>
      ) : null}
      {supply.unresolved ? (
        <p className="commercial-gst-supply__alert" role="status">
          Place of Supply could not be determined. Complete the customer or delivery tax details
          before posting.
        </p>
      ) : null}

      {canOverride && !readOnly ? (
        <div className="commercial-gst-supply__override">
          <label className="commercial-gst-supply__override-label">
            <input
              type="checkbox"
              className="commercial-gst-supply__override-check"
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
            <span className="commercial-gst-supply__override-text">
              <ShieldAlert className="commercial-gst-supply__override-icon" aria-hidden />
              Override place of supply
            </span>
          </label>
          <span className="commercial-gst-supply__override-note">
            Requires permission crm.commercial.tax_place_override
          </span>
        </div>
      ) : null}

      {value.placeOfSupplyOverride && !readOnly ? (
        <div className="commercial-gst-supply__reason">
          <label className="commercial-gst-supply__reason-label" htmlFor="gst-pos-override-reason">
            Override reason
            <span className="commercial-gst-supply__reason-req">Required for audit trail</span>
          </label>
          <Textarea
            id="gst-pos-override-reason"
            rows={2}
            value={value.placeOfSupplyOverrideReason}
            onChange={(e) => patch({ placeOfSupplyOverrideReason: e.target.value })}
            placeholder="Why is Place of Supply different from auto resolution?"
          />
        </div>
      ) : null}

      {!supply.unresolved && (supply.warnings.length > 0 || effective.warnings.length > 0) ? (
        <p className="commercial-gst-supply__warnings">
          {[...supply.warnings, ...effective.warnings].join(' · ')}
        </p>
      ) : null}
    </section>
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
  const normalisedType: CommercialSupplyType =
    supplyType === 'INTRA_STATE' || supplyType === 'INTER_STATE' ? supplyType : 'UNRESOLVED'
  const display = supplyTypeDisplay(
    normalisedType,
    (gstScheme as CommercialGstScheme) || 'UNRESOLVED',
  )

  return (
    <div
      className="commercial-gst-supply commercial-gst-supply--readonly"
      aria-label="GST supply"
    >
      <div className="commercial-gst-supply__tiles">
        <div className="commercial-gst-supply__tile">
          <div className="commercial-gst-supply__tile-label">Supplier state</div>
          <div className="commercial-gst-supply__tile-value">
            {formatPlaceOfSupplyLabel(supplierStateCode) || supplierStateCode || '—'}
          </div>
        </div>
        <div className="commercial-gst-supply__tile">
          <div className="commercial-gst-supply__tile-label">
            Place of supply
            {placeOfSupplyOverride ? ' (override)' : ''}
          </div>
          <div className="commercial-gst-supply__tile-value">{posLabel}</div>
          {placeOfSupplySource ? (
            <div className="commercial-gst-supply__tile-hint">
              {formatPlaceOfSupplySourceLabel(
                placeOfSupplySource as CommercialPlaceOfSupplySource,
              )}
            </div>
          ) : null}
          {placeOfSupplyOverride && placeOfSupplyOverrideReason ? (
            <div className="commercial-gst-supply__tile-hint">{placeOfSupplyOverrideReason}</div>
          ) : null}
        </div>
        <div className="commercial-gst-supply__tile commercial-gst-supply__tile--type">
          <div className="commercial-gst-supply__tile-label">Supply type</div>
          <div className="commercial-gst-supply__type-row" aria-readonly="true">
            {normalisedType !== 'UNRESOLVED' ? (
              <>
                <span
                  className={cn(
                    'commercial-gst-supply__chip',
                    supplyTypeChipClass(normalisedType),
                  )}
                >
                  {display.primary}
                </span>
                <span className="commercial-gst-supply__scheme">{display.scheme}</span>
              </>
            ) : (
              <div className="commercial-gst-supply__tile-value">
                {supplyType || 'Unresolved'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
