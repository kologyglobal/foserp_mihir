import { useMemo, useState, type ReactNode } from 'react'
import { TabStrip, type TabItem } from '@/components/ui/TabStrip'
import { Textarea } from '@/components/forms/Inputs'
import { cn } from '@/utils/cn'

export type PurchaseTermsNotesTabId = 'terms' | 'notes' | 'remarks' | 'attachments'

export type PurchaseTermsNotesValues = {
  termsAndConditions: string
  internalNotes: string
  remarks: string
}

export type PurchaseTermsNotesTabsProps = {
  values: PurchaseTermsNotesValues
  onChange: (patch: Partial<PurchaseTermsNotesValues>) => void
  disabled?: boolean
  className?: string
  /** Initial tab when the section opens. Default: terms. */
  defaultTab?: PurchaseTermsNotesTabId
  /**
   * When provided, adds an Attachments tab and renders this panel only while that tab is active.
   * Keeps a single visible panel in the Terms/Notes/Attachments strip.
   */
  attachmentsPanel?: ReactNode
  /** Dot indicator + tooltip for the Attachments tab (e.g. file count preview). */
  attachmentsIndicator?: boolean
  attachmentsTitle?: string
}

const TEXT_TAB_ORDER: Array<Exclude<PurchaseTermsNotesTabId, 'attachments'>> = [
  'terms',
  'notes',
  'remarks',
]

const TAB_META: Record<
  Exclude<PurchaseTermsNotesTabId, 'attachments'>,
  {
    label: string
    field: keyof PurchaseTermsNotesValues
    rows: number
    minHeightClass: string
    placeholder: string
  }
> = {
  terms: {
    label: 'Terms & Conditions',
    field: 'termsAndConditions',
    rows: 5,
    minHeightClass: 'min-h-[140px] max-h-[160px]',
    placeholder: 'Payment, delivery, warranty, and commercial terms…',
  },
  notes: {
    label: 'Internal Notes',
    field: 'internalNotes',
    rows: 3,
    minHeightClass: 'min-h-[90px] max-h-[100px]',
    placeholder: 'Internal team notes (not printed)…',
  },
  remarks: {
    label: 'Remarks',
    field: 'remarks',
    rows: 2,
    minHeightClass: 'min-h-[70px] max-h-[80px]',
    placeholder: 'Short remarks for this document…',
  },
}

function previewSnippet(value: string, max = 48): string {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  if (!oneLine) return ''
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/**
 * Compact Terms / Internal Notes / Remarks (+ optional Attachments) — one panel visible at a time.
 * Shared by PO create/edit and revise (reuse when invoice/return gain the same trio).
 */
export function PurchaseTermsNotesTabs({
  values,
  onChange,
  disabled,
  className,
  defaultTab = 'terms',
  attachmentsPanel,
  attachmentsIndicator,
  attachmentsTitle,
}: PurchaseTermsNotesTabsProps) {
  const hasAttachments = attachmentsPanel != null
  const initialTab =
    defaultTab === 'attachments' && !hasAttachments ? 'terms' : defaultTab
  const [active, setActive] = useState<PurchaseTermsNotesTabId>(initialTab)

  const tabs = useMemo((): TabItem<PurchaseTermsNotesTabId>[] => {
    const textTabs = TEXT_TAB_ORDER.map((id) => {
      const meta = TAB_META[id]
      const raw = values[meta.field]
      const snippet = previewSnippet(raw)
      return {
        id,
        label: meta.label,
        indicator: Boolean(snippet),
        title: snippet || undefined,
      }
    })
    if (!hasAttachments) return textTabs
    return [
      ...textTabs,
      {
        id: 'attachments' as const,
        label: 'Attachments',
        indicator: Boolean(attachmentsIndicator),
        title: attachmentsTitle,
      },
    ]
  }, [values, hasAttachments, attachmentsIndicator, attachmentsTitle])

  const showAttachments = hasAttachments && active === 'attachments'
  const textMeta = active !== 'attachments' ? TAB_META[active] : null

  return (
    <div className={cn('col-span-full w-full', className)}>
      <TabStrip
        tabs={tabs}
        active={active}
        onChange={(id) => {
          if (id === 'attachments' && !hasAttachments) return
          setActive(id)
        }}
        className="rounded-t-md border border-b-0 border-erp-border"
      />
      <div className="rounded-b-md border border-erp-border bg-erp-surface px-3 py-2.5">
        {showAttachments ? (
          attachmentsPanel
        ) : textMeta ? (
          <>
            <label className="sr-only" htmlFor={`purchase-terms-notes-${active}`}>
              {textMeta.label}
            </label>
            <Textarea
              id={`purchase-terms-notes-${active}`}
              rows={textMeta.rows}
              disabled={disabled}
              value={values[textMeta.field]}
              placeholder={textMeta.placeholder}
              className={cn(textMeta.minHeightClass, 'resize-y')}
              onChange={(e) => onChange({ [textMeta.field]: e.target.value })}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
