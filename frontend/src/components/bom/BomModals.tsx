import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { FormField } from '../forms/FormField'
import { Input, Select } from '../forms/Inputs'
import { ItemLookupSelect } from '../lookups/ItemLookupSelect'
import type { BomSourceType } from '../../types/bom'

interface AddChildLineModalProps {
  open: boolean
  onClose: () => void
  parentLabel: string | null
  onAdd: (itemId: string, qty: number, scrapPct: number, sourceType: BomSourceType) => void
}

export function AddChildLineModal({
  open,
  onClose,
  parentLabel,
  onAdd,
}: AddChildLineModalProps) {
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [scrapPct, setScrapPct] = useState(0)
  const [sourceType, setSourceType] = useState<BomSourceType>('buy')
  const [error, setError] = useState('')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemId) { setError('Select an item from Item Master'); return }
    onAdd(itemId, qty, scrapPct, sourceType)
    setItemId('')
    setQty(1)
    setScrapPct(0)
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Add BOM Line</h3>
            <p className="text-xs text-slate-500">
              {parentLabel ? `Under: ${parentLabel}` : 'Root level assembly'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <FormField label="Item (from Item Master)" required error={error}>
            <ItemLookupSelect
              value={itemId}
              onChange={(sel) => setItemId(sel?.itemId ?? '')}
              error={Boolean(error)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Qty Per Parent">
              <Input type="number" min={0.001} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </FormField>
            <FormField label="Scrap %">
              <Input type="number" min={0} max={100} value={scrapPct} onChange={(e) => setScrapPct(Number(e.target.value))} />
            </FormField>
          </div>
          <FormField label="Source Type">
            <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as BomSourceType)}>
              <option value="buy">Buy</option>
              <option value="make">Make</option>
              <option value="subcontract">Subcontract</option>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">Add Line</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditQtyModalProps {
  open: boolean
  lineLabel: string
  qty: number
  scrapPct: number
  onClose: () => void
  onSave: (qty: number, scrapPct: number) => void
}

export function EditQtyModal({ open, lineLabel, qty, scrapPct, onClose, onSave }: EditQtyModalProps) {
  const [q, setQ] = useState(qty)
  const [s, setS] = useState(scrapPct)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="border-b border-erp-border px-5 py-4">
          <h3 className="font-semibold text-slate-900">Edit Quantity</h3>
          <p className="text-xs text-slate-500">{lineLabel}</p>
        </div>
        <div className="space-y-4 p-5">
          <FormField label="Qty Per Parent">
            <Input type="number" min={0.001} step="any" value={q} onChange={(e) => setQ(Number(e.target.value))} />
          </FormField>
          <FormField label="Scrap %">
            <Input type="number" min={0} max={100} value={s} onChange={(e) => setS(Number(e.target.value))} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onSave(q, s); onClose() }}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RevisionCompareModalProps {
  open: boolean
  onClose: () => void
  revALabel: string
  revBLabel: string
  rows: { field: string; revA: string | number; revB: string | number; changed: boolean }[]
}

export function RevisionCompareModal({ open, onClose, revALabel, revBLabel, rows }: RevisionCompareModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-erp-border bg-white px-5 py-4">
          <h3 className="font-semibold text-slate-900">Revision Compare</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>{revALabel}</th>
              <th>{revBLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="py-6 text-center text-slate-500">No differences found</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.field} className={r.changed ? 'bg-amber-50' : ''}>
                  <td className="font-medium">{r.field}</td>
                  <td>{r.revA}</td>
                  <td>{r.revB}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
