import { Copy, Plus, Trash2 } from 'lucide-react'
import type { QuotationSpecRow } from '../../types/crm'

interface QuotationTechnicalSpecEditorProps {
  rows: QuotationSpecRow[]
  locked?: boolean
  onChange: (rows: QuotationSpecRow[]) => void
}

function newRow(sectionNo?: string): QuotationSpecRow {
  return {
    id: `spec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sectionNo: sectionNo ?? '',
    label: 'Specification',
    value: '',
    required: false,
  }
}

export function QuotationTechnicalSpecEditor({ rows, locked, onChange }: QuotationTechnicalSpecEditorProps) {
  const updateRow = (id: string, patch: Partial<QuotationSpecRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addRow = () => onChange([...rows, newRow()])

  const duplicateRow = (id: string) => {
    const src = rows.find((r) => r.id === id)
    if (!src) return
    onChange([...rows, { ...src, id: newRow().id }])
  }

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  if (locked) {
    return (
      <div className="quo-spec-read">
        {rows.map((r) => (
          <div key={r.id} className="quo-spec-read__row">
            <span className="quo-spec-read__no">{r.sectionNo}</span>
            <div className="quo-spec-read__body">
              <strong>{r.label}</strong>
              <p>{r.value || '—'}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="quo-spec-editor">
      <div className="quo-spec-editor__head">
        <span className="quo-spec-editor__col-no">No.</span>
        <span className="quo-spec-editor__col-label">Label</span>
        <span className="quo-spec-editor__col-value">Value</span>
        <span className="quo-spec-editor__col-unit">Unit</span>
        <span className="quo-spec-editor__col-actions" />
      </div>
      {rows.map((row) => (
        <div key={row.id} className="quo-spec-editor__row">
          <input
            className="quo-spec-editor__input quo-spec-editor__input--no"
            value={row.sectionNo ?? ''}
            onChange={(e) => updateRow(row.id, { sectionNo: e.target.value })}
            placeholder="1.1"
            aria-label="Section number"
          />
          <input
            className="quo-spec-editor__input"
            value={row.label}
            onChange={(e) => updateRow(row.id, { label: e.target.value })}
            placeholder="Label"
            aria-label="Specification label"
          />
          <textarea
            className="quo-spec-editor__textarea"
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
            placeholder="Specification value"
            rows={2}
            aria-label="Specification value"
          />
          <input
            className="quo-spec-editor__input quo-spec-editor__input--unit"
            value={row.unit ?? ''}
            onChange={(e) => updateRow(row.id, { unit: e.target.value })}
            placeholder="Unit"
            aria-label="Unit"
          />
          <div className="quo-spec-editor__actions">
            <button type="button" className="quo-spec-editor__btn" onClick={() => duplicateRow(row.id)} aria-label="Duplicate row">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="quo-spec-editor__btn quo-spec-editor__btn--danger" onClick={() => removeRow(row.id)} aria-label="Remove row">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="quo-spec-editor__add" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add specification row
      </button>
    </div>
  )
}
