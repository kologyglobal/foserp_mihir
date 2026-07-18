import { useEffect, useRef, useState } from 'react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { FormField } from '../forms/FormField'
import { Input, Select, Textarea } from '../forms/Inputs'
import type { QuotationPageSize, QuotationPrintLayout } from '../../types/quotation'
import { DEFAULT_QUOTATION_PRINT_LAYOUT } from '../../utils/quotationEngine/printLayout'

export type QuotationTemplateOrientation = 'portrait' | 'landscape'

export type CreateBlankQuotationTemplateValues = {
  templateName: string
  templateType: string
  pageSize: QuotationPageSize
  orientation: QuotationTemplateOrientation
  defaultCurrency: string
  description: string
  printLayout: QuotationPrintLayout
}

const TEMPLATE_TYPE_OPTIONS = [
  { value: 'Custom', label: 'Custom' },
  { value: 'Technical-Commercial', label: 'Technical-Commercial' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Service', label: 'Service' },
]

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'AED', label: 'AED — UAE Dirham' },
]

interface CreateBlankQuotationTemplateModalProps {
  open: boolean
  defaultName?: string
  onClose: () => void
  onCreate: (values: CreateBlankQuotationTemplateValues) => void | Promise<void>
}

export function CreateBlankQuotationTemplateModal({
  open,
  defaultName = 'Custom Quotation Template',
  onClose,
  onCreate,
}: CreateBlankQuotationTemplateModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [templateName, setTemplateName] = useState(defaultName)
  const [templateType, setTemplateType] = useState('Custom')
  const [pageSize, setPageSize] = useState<QuotationPageSize>('A4')
  const [orientation, setOrientation] = useState<QuotationTemplateOrientation>('portrait')
  const [defaultCurrency, setDefaultCurrency] = useState('INR')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTemplateName(defaultName)
    setTemplateType('Custom')
    setPageSize('A4')
    setOrientation('portrait')
    setDefaultCurrency('INR')
    setDescription('')
    setError(null)
    setSubmitting(false)
  }, [open, defaultName])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, submitting])

  if (!open) return null

  async function handleCreate() {
    const name = templateName.trim()
    if (!name) {
      setError('Template name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    const printLayout: QuotationPrintLayout = {
      ...DEFAULT_QUOTATION_PRINT_LAYOUT,
      pageSize,
    }
    try {
      await onCreate({
        templateName: name,
        templateType: templateType.trim() || 'Custom',
        pageSize,
        orientation,
        defaultCurrency,
        description: description.trim(),
        printLayout,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create template')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="erp-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="erp-modal-panel max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blank-quotation-template-title"
      >
        <h2 id="blank-quotation-template-title" className="text-[16px] font-semibold text-erp-text">
          Create Blank Template
        </h2>
        <p className="mt-1 text-[13px] text-erp-muted">
          Start a new quotation template with print defaults. You can edit sections in the designer next.
        </p>

        <div className="mt-4 space-y-3">
          <FormField label="Template Name" required>
            <Input
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="e.g. Custom Quotation Template"
              disabled={submitting}
            />
          </FormField>

          <FormField label="Template Type" required>
            <Select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              disabled={submitting}
            >
              {TEMPLATE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Page Size" required>
              <Select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as QuotationPageSize)}
                disabled={submitting}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </Select>
            </FormField>
            <FormField label="Orientation" required>
              <Select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as QuotationTemplateOrientation)}
                disabled={submitting}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Default Currency" required>
            <Select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              disabled={submitting}
            >
              {CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Description" hint="Optional — stored as default commercial terms intro">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of when to use this template"
              disabled={submitting}
            />
          </FormField>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" onClick={() => void handleCreate()} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Template'}
          </ErpButton>
        </ErpButtonGroup>
      </div>
    </div>
  )
}

/** Build defaultTerms text from blank-template modal values (currency / orientation notes). */
export function blankTemplateDefaultTerms(values: CreateBlankQuotationTemplateValues): string {
  const parts = [
    values.description.trim(),
    values.defaultCurrency ? `Default currency: ${values.defaultCurrency}` : '',
    values.orientation === 'landscape' ? 'Print orientation: landscape' : '',
  ].filter(Boolean)
  return parts.join('\n')
}
