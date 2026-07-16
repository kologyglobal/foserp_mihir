import { cn } from '../../utils/cn'

export interface EnterpriseDocumentStripField {
  label: string
  value: string
  highlight?: boolean
}

/** BC-style compact document information strip below the command header */
export function EnterpriseDocumentStrip({
  fields,
  className,
}: {
  fields: EnterpriseDocumentStripField[]
  className?: string
}) {
  if (!fields.length) return null

  return (
    <div className={cn('ent-ws-doc-strip', className)} role="region" aria-label="Document information">
      {fields.map((field) => (
        <div key={field.label} className="ent-ws-doc-strip__field">
          <span className="ent-ws-doc-strip__label">{field.label}</span>
          <span className={cn('ent-ws-doc-strip__value', field.highlight && 'ent-ws-doc-strip__value--highlight')}>
            {field.value || '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
