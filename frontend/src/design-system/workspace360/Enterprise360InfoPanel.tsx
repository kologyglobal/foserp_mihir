import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Enterprise360InfoSection } from './types'

function InfoSection({ section }: { section: Enterprise360InfoSection }) {
  const [open, setOpen] = useState(section.defaultOpen !== false)
  const collapsible = section.collapsible !== false

  return (
    <section className="ent-360-info-section" id={section.id}>
      <button
        type="button"
        className="ent-360-info-section__head"
        onClick={() => collapsible && setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2 className="ent-360-info-section__title">{section.title}</h2>
        {collapsible ? <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} /> : null}
      </button>
      {open ? (
        <dl className="ent-360-info-section__grid">
          {section.fields.map((field) => (
            <div
              key={field.label}
              className={cn('ent-360-info-field', field.colSpan === 2 && 'ent-360-info-field--wide')}
            >
              <dt className="ent-360-info-field__label">{field.label}</dt>
              <dd className="ent-360-info-field__value">{field.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

export function Enterprise360InfoPanel({ sections }: { sections: Enterprise360InfoSection[] }) {
  return (
    <div className="ent-360-info-panel">
      {sections.map((section) => (
        <InfoSection key={section.id} section={section} />
      ))}
    </div>
  )
}
