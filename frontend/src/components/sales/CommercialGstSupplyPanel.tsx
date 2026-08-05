/**
 * Shared GST supply chrome: auto Place of Supply, read-only supply type, authorised override.
 */
import { useMemo } from 'react'
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
  formatSupplyTypeLabel,
  formatTaxSchemeLabel,
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
  type CommercialPlaceOfSupplySource,
} from '../../utils/commercialSupplyContext'
import { canCrmPermission } from '../../utils/permissions/crm'
import { cn } from '../../utils/cn'

const GST_STATE_OPTIONS = listGstStateSelectOptions()

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
  /** When false, hide override controls even if user has permission. */
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
    if (value.placeOfSupply && !value.placeOfSupplyOverride) {
      const code = resolveGstStateCode(value.placeOfSupply)
      if (code) {
        return {
          placeOfSupplyStateCode: code,
          placeOfSupplyLabel: formatPlaceOfSupplyLabel(code, value.placeOfSupply) || code,
          source: 'AUTO' as CommercialPlaceOfSupplySource,
          warnings: [] as string[],
        }
      }
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

  const patch = (partial: Partial<CommercialGstSupplyValue>) => {
    onChange({ ...value, ...partial })
  }

  return (
    <ErpFieldGroup
      label="GST supply"
      className={cn('commercial-gst-supply', className)}
      columns={columns}
    >
      <ErpFieldRow
        label="Supplier state"
        hint="Legal entity / company registration state"
        readOnly={readOnly}
      >
        {readOnly ? (
          <Input
            value={
              formatPlaceOfSupplyLabel(value.supplierStateCode) ||
              value.supplierStateCode ||
              '—'
            }
            readOnly
          />
        ) : (
          <Select
            value={value.supplierStateCode}
            onChange={(e) => patch({ supplierStateCode: e.target.value })}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {GST_STATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        )}
      </ErpFieldRow>

      <ErpFieldRow
        label="Place of supply"
        hint={
          value.placeOfSupplyOverride
            ? 'Authorised override'
            : `Auto: ${autoPos.placeOfSupplyLabel || '—'} (${autoPos.source})`
        }
        readOnly={readOnly || (!canOverride && !value.placeOfSupplyOverride)}
      >
        {readOnly || (!canOverride && value.placeOfSupplyOverride) ? (
          <Input
            value={
              effective.placeOfSupplyLabel ||
              formatPlaceOfSupplyLabel(effective.placeOfSupplyStateCode) ||
              '—'
            }
            readOnly
          />
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
          <Input
            value={
              autoPos.placeOfSupplyLabel ||
              formatPlaceOfSupplyLabel(autoPos.placeOfSupplyStateCode) ||
              '—'
            }
            readOnly
          />
        )}
      </ErpFieldRow>

      <ErpFieldRow
        label="Supply type"
        hint={formatTaxSchemeLabel(supply.taxScheme)}
        readOnly
      >
        <Input
          value={formatSupplyTypeLabel(supply.supplyType)}
          readOnly
          className="font-medium"
        />
      </ErpFieldRow>

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
                    ? (resolveGstStateCode(value.placeOfSupply) ||
                        autoPos.placeOfSupplyStateCode ||
                        '')
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

      {(supply.unresolved || effective.warnings.length > 0) && (
        <p className="col-span-full text-[12px] text-amber-700">
          {[...supply.warnings, ...effective.warnings].join(' · ') ||
            'Supply type unresolved — set supplier state and Place of Supply.'}
        </p>
      )}
    </ErpFieldGroup>
  )
}

/** Read-only strip for detail / print contexts. */
export function CommercialGstSupplyReadOnly({
  supplierStateCode,
  placeOfSupply,
  placeOfSupplyStateCode,
  supplyType,
  gstScheme,
  placeOfSupplyOverride,
  placeOfSupplyOverrideReason,
}: {
  supplierStateCode?: string | null
  placeOfSupply?: string | null
  placeOfSupplyStateCode?: string | null
  supplyType?: string | null
  gstScheme?: string | null
  placeOfSupplyOverride?: boolean
  placeOfSupplyOverrideReason?: string | null
}) {
  const posLabel =
    placeOfSupply ||
    formatPlaceOfSupplyLabel(placeOfSupplyStateCode) ||
    '—'
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
        {placeOfSupplyOverride && placeOfSupplyOverrideReason ? (
          <div className="mt-0.5 text-[11px] text-erp-muted">{placeOfSupplyOverrideReason}</div>
        ) : null}
      </div>
      <div>
        <div className="text-erp-muted">Supply type</div>
        <div className="font-medium text-erp-text">
          {supplyType === 'INTRA_STATE'
            ? 'Intra-state'
            : supplyType === 'INTER_STATE'
              ? 'Inter-state'
              : supplyType || 'Unresolved'}
          {gstScheme ? ` · ${formatTaxSchemeLabel(gstScheme)}` : ''}
        </div>
      </div>
    </div>
  )
}
