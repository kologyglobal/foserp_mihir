import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useMasterStore } from '../../store/masterStore'
import { useActiveUoms } from '../../hooks/useMasterLists'
import { GST_GOODS_TYPE_LABELS } from '../../types/taxMaster'

export function HsnMasterSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      hsnMasters
        .filter((h) => h.isActive)
        .map((h) => ({
          value: h.id,
          label: `${h.code} — ${h.description.slice(0, 40)}`,
          searchText: `${h.code} ${h.description}`.toLowerCase(),
          meta: getGstGroup(h.gstGroupId)?.code,
        })),
    [hsnMasters, getGstGroup],
  )

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select HSN code…"
      disabled={disabled}
      allowEmpty={allowEmpty}
    />
  )
}

export function GstGroupSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
  goodsType,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  allowEmpty?: boolean
  goodsType?: 'goods' | 'service'
}) {
  const gstGroups = useMasterStore((s) => s.gstGroups)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      gstGroups
        .filter((g) => g.isActive && (!goodsType || g.goodsType === goodsType))
        .map((g) => ({
          value: g.id,
          label: g.code,
          searchText: `${g.code} ${g.description}`.toLowerCase(),
          meta: GST_GOODS_TYPE_LABELS[g.goodsType],
        })),
    [gstGroups, goodsType],
  )

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select GST group…"
      disabled={disabled}
      allowEmpty={allowEmpty}
    />
  )
}

export function UomMasterSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const uoms = useActiveUoms()

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      uoms.map((u) => ({
        value: u.id,
        label: `${u.uomCode} — ${u.description ?? u.uomName}`,
        searchText: `${u.uomCode} ${u.uomName}`.toLowerCase(),
      })),
    [uoms],
  )

  return (
    <ErpSmartSelect options={options} value={value} onChange={onChange} placeholder="Select UOM…" disabled={disabled} />
  )
}

export function GeoStateSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Select state…',
}: {
  value: string
  onChange: (stateName: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const geoStates = useMasterStore((s) => s.geoStates)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      geoStates.map((s) => ({
        value: s.stateName,
        label: s.stateName,
        searchText: `${s.stateName} ${s.stateCode}`.toLowerCase(),
        meta: s.stateCode,
      })),
    [geoStates],
  )

  return (
    <ErpSmartSelect options={options} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
  )
}
