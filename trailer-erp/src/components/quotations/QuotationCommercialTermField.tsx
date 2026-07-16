import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Select } from '../forms/Inputs'
import {
  buildCommercialTermText,
  commercialTermKindForSection,
  commercialTermRequiresApproval,
  inferSectionMasterCode,
  resolveCommercialTermOptions,
  type QuotationCommercialTermKind,
} from '../../utils/quotationTermUtils'
import type { QuotationSection } from '../../types/crm'

const MASTER_LINKS: Record<QuotationCommercialTermKind, string> = {
  'payment-terms': '/masters/payment-terms',
  'delivery-terms': '/crm/masters/delivery-terms',
  'warranty-terms': '/crm/masters/warranty-terms',
}

interface QuotationCommercialTermFieldProps {
  section: QuotationSection
  locked?: boolean
  onChange: (patch: Partial<QuotationSection>) => void
}

export function QuotationCommercialTermField({ section, locked, onChange }: QuotationCommercialTermFieldProps) {
  const kind = commercialTermKindForSection(section.sectionType)
  const options = useMemo(() => (kind ? resolveCommercialTermOptions(kind) : []), [kind])
  const selectedCode = inferSectionMasterCode(section)
  const isCustom = !selectedCode
  const needsApproval = kind && selectedCode ? commercialTermRequiresApproval(kind, selectedCode) : false

  if (!kind) return null

  function selectMaster(code: string) {
    if (!code) {
      onChange({ masterCode: null })
      return
    }
    onChange({
      masterCode: code,
      content: buildCommercialTermText(kind!, code),
    })
  }

  function editContent(content: string) {
    onChange({
      masterCode: null,
      content,
    })
  }

  if (locked) {
    return (
      <div className="quo-commercial-term">
        <div className="quo-commercial-term__content-read">{section.content || '—'}</div>
        {selectedCode ? (
          <p className="quo-commercial-term__meta">Master: {selectedCode}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="quo-commercial-term">
      <div className="quo-commercial-term__picker">
        <label className="quo-commercial-term__label" htmlFor={`quo-term-${section.id}`}>
          Select from CRM Master
        </label>
        <Select
          id={`quo-term-${section.id}`}
          value={selectedCode ?? ''}
          onChange={(e) => selectMaster(e.target.value)}
        >
          <option value="">Custom terms</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.approvalRequired ? ' (approval required)' : ''}
            </option>
          ))}
        </Select>
        <Link to={MASTER_LINKS[kind]} className="quo-commercial-term__master-link">
          Manage {kind.replace('-', ' ')}
        </Link>
      </div>

      {needsApproval ? (
        <p className="quo-commercial-term__approval">
          <AlertTriangle className="h-3.5 w-3.5" />
          This term requires finance / management approval before sending.
        </p>
      ) : null}

      <label className="quo-commercial-term__label" htmlFor={`quo-term-content-${section.id}`}>
        {isCustom ? 'Custom terms text' : 'Terms text (edit to customize)'}
      </label>
      <textarea
        id={`quo-term-content-${section.id}`}
        className="quo-editor-section__textarea"
        value={section.content}
        onChange={(e) => editContent(e.target.value)}
        rows={5}
        placeholder="Enter commercial terms for this section"
      />
    </div>
  )
}
