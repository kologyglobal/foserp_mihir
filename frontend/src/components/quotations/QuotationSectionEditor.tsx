import type { MutableRefObject } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { QuotationSection, QuotationSectionType } from '../../types/crm'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { QuotationTechnicalSpecEditor } from './QuotationTechnicalSpecEditor'
import { QuotationCommercialTermField } from './QuotationCommercialTermField'
import { commercialTermKindForSection } from '../../utils/quotationTermUtils'
import { PRINT_LAYOUT_SECTION_OPTIONS } from '../../utils/quotationEngine/printLayout'
import { QUOTATION_PLACEHOLDERS } from '../../utils/quotationEngine/placeholders'

const SECTION_TYPES = PRINT_LAYOUT_SECTION_OPTIONS

const SECTION_TYPE_LABEL: Record<QuotationSectionType, string> = Object.fromEntries(
  SECTION_TYPES.map((t) => [t.id, t.label]),
) as Record<QuotationSectionType, string>

interface QuotationSectionEditorProps {
  sections: QuotationSection[]
  locked?: boolean
  onChange: (sections: QuotationSection[]) => void
  renderPriceTable?: () => React.ReactNode
  sectionRefs?: MutableRefObject<Record<string, HTMLElement | null>>
  onSectionFocus?: (sectionId: string) => void
  /** Template designer — show full section-type palette */
  templateMode?: boolean
}

export function QuotationSectionEditor({
  sections,
  locked,
  onChange,
  renderPriceTable,
  sectionRefs,
  onSectionFocus,
  templateMode,
}: QuotationSectionEditorProps) {
  const sorted = [...sections].sort((a, b) => a.sequenceNo - b.sequenceNo)

  const updateSection = (id: string, patch: Partial<QuotationSection>) => {
    onChange(sorted.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeSection = (id: string) => {
    onChange(sorted.filter((s) => s.id !== id).map((s, i) => ({ ...s, sequenceNo: i + 1 })))
  }

  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((s) => s.id === id)
    const target = idx + dir
    if (target < 0 || target >= sorted.length) return
    const next = [...sorted]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next.map((s, i) => ({ ...s, sequenceNo: i + 1 })))
  }

  const addSection = (type: QuotationSectionType = 'custom', title?: string) => {
    const label = SECTION_TYPE_LABEL[type] ?? 'Custom Section'
    const isSpec = type === 'specification' || type === 'technical'
    const sec: QuotationSection = {
      id: `sec-${Date.now()}`,
      sectionType: type,
      title: title ?? label,
      content: '',
      sequenceNo: sorted.length + 1,
      editable: true,
      contentFormat: isSpec ? 'spec_table' : 'richtext',
      specRows: isSpec ? [] : undefined,
    }
    onChange([...sorted, sec])
  }

  const insertPlaceholder = (sectionId: string, key: string) => {
    const sec = sorted.find((s) => s.id === sectionId)
    if (!sec) return
    updateSection(sectionId, { content: `${sec.content}{{${key}}}` })
  }

  return (
    <div className="quo-editor-sections">
      {sorted.map((sec, idx) => (
        <section
          key={sec.id}
          id={`quo-section-${sec.id}`}
          ref={(el) => {
            if (sectionRefs) sectionRefs.current[sec.id] = el
          }}
          className="quo-editor-section"
          onFocus={() => onSectionFocus?.(sec.id)}
        >
          <header className="quo-editor-section__head">
            <div className="quo-editor-section__head-left">
              <span className="quo-editor-section__index">{idx + 1}</span>
              <DynamicsStatusChip label={SECTION_TYPE_LABEL[sec.sectionType] ?? sec.sectionType} tone="neutral" />
              {locked ? (
                <h3 className="quo-editor-section__title">{sec.title}</h3>
              ) : (
                <input
                  className="quo-editor-section__title-input"
                  value={sec.title}
                  onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                  aria-label="Section title"
                />
              )}
            </div>
            {!locked ? (
              <div className="quo-editor-section__actions">
                <button type="button" className="quo-editor-section__btn" onClick={() => moveSection(sec.id, -1)} disabled={idx === 0} aria-label="Move up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className="quo-editor-section__btn" onClick={() => moveSection(sec.id, 1)} disabled={idx === sorted.length - 1} aria-label="Move down">
                  <ChevronDown className="h-4 w-4" />
                </button>
                {sec.sectionType !== 'price_table' ? (
                  <button type="button" className="quo-editor-section__btn quo-editor-section__btn--danger" onClick={() => removeSection(sec.id)} aria-label="Remove section">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>

          <div className="quo-editor-section__body">
            {sec.sectionType === 'price_table' && renderPriceTable ? (
              renderPriceTable()
            ) : commercialTermKindForSection(sec.sectionType) ? (
              <QuotationCommercialTermField
                section={sec}
                locked={locked}
                onChange={(patch) => updateSection(sec.id, patch)}
              />
            ) : sec.contentFormat === 'spec_table' ? (
              <QuotationTechnicalSpecEditor
                rows={sec.specRows ?? []}
                locked={locked}
                onChange={(specRows) => updateSection(sec.id, { specRows, contentFormat: 'spec_table' })}
              />
            ) : locked ? (
              <div className="quo-editor-section__content-read">{sec.content || '—'}</div>
            ) : (
              <>
                <textarea
                  className="quo-editor-section__textarea"
                  value={sec.content}
                  onChange={(e) => updateSection(sec.id, { content: e.target.value })}
                  placeholder="Enter section content — use {{placeholders}} for merge fields"
                  rows={6}
                />
                <div className="quo-editor-section__placeholders">
                  {QUOTATION_PLACEHOLDERS.slice(0, 8).map((p) => (
                    <button key={p} type="button" className="quo-editor-section__placeholder-btn" onClick={() => insertPlaceholder(sec.id, p)}>
                      {`{{${p}}}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ))}

      {!locked ? (
        <div className="quo-editor-section-add">
          <button type="button" className="quo-editor-section-add__primary" onClick={() => addSection()}>
            <Plus className="h-4 w-4" />
            Add section
          </button>
          <div className="quo-editor-section-add__presets">
            {(templateMode ? SECTION_TYPES : SECTION_TYPES.filter((t) => t.id !== 'price_table').slice(0, 8)).map((t) => (
              <button
                key={t.id}
                type="button"
                className="quo-editor-section-add__preset"
                onClick={() => addSection(t.id, t.label)}
              >
                + {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
