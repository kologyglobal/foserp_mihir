import { useNavigate } from 'react-router-dom'
import { Bookmark, Copy, Eye, Layers, Pencil, ChevronRight } from 'lucide-react'
import type { QuotationTemplate } from '../../types/crm'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'

interface QuotationTemplateCardProps {
  template: QuotationTemplate
  onDuplicate: (id: string) => void
}

export function QuotationTemplateCard({ template: t, onDuplicate }: QuotationTemplateCardProps) {
  const navigate = useNavigate()
  const specSections = t.sections.filter((s) => s.contentFormat === 'spec_table').length

  return (
    <article className="crm-template-card">
      <button
        type="button"
        className="crm-template-card__main"
        onClick={() => navigate(`/crm/quotation-templates/${t.id}`)}
      >
        <div className="crm-template-card__head">
          <div className="crm-template-card__icon" aria-hidden>
            <Bookmark className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="crm-template-card__title">{t.templateName}</p>
            <p className="crm-template-card__family">{t.productFamily}</p>
          </div>
          <DynamicsStatusChip
            label={t.isActive ? 'Active' : 'Inactive'}
            tone={t.isActive ? 'success' : 'neutral'}
          />
        </div>

        <div className="crm-template-card__stats">
          <div>
            <p className="crm-template-card__stat-label">Sections</p>
            <p className="crm-template-card__stat-value">{t.sections.length}</p>
          </div>
          <div>
            <p className="crm-template-card__stat-label">Spec tables</p>
            <p className="crm-template-card__stat-value">{specSections}</p>
          </div>
          <div>
            <p className="crm-template-card__stat-label">Version</p>
            <p className="crm-template-card__stat-value">v{t.version ?? 1}</p>
          </div>
        </div>

        {t.defaultTerms ? (
          <p className="crm-template-card__terms">{t.defaultTerms}</p>
        ) : null}

        <span className="crm-template-card__open">
          View template
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>

      <footer className="crm-template-card__footer">
        <button
          type="button"
          className="crm-card-action crm-card-action--primary"
          onClick={() => navigate(`/crm/quotation-templates/${t.id}/editor`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          className="crm-card-action"
          onClick={() => navigate(`/crm/quotation-templates/${t.id}/preview`)}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
        <button
          type="button"
          className="crm-card-action"
          onClick={() => onDuplicate(t.id)}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </button>
      </footer>
    </article>
  )
}

export function QuotationTemplateEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="crm-template-empty">
      <div className="crm-template-empty__icon">
        <Layers className="h-8 w-8" />
      </div>
      <p className="crm-template-empty__title">No templates match your filters</p>
      <p className="crm-template-empty__hint">Create a reusable quotation template for ISO tanks, trailers, or services.</p>
      <button type="button" className="crm-card-action crm-card-action--primary" onClick={onCreate}>
        Create template
      </button>
    </div>
  )
}
