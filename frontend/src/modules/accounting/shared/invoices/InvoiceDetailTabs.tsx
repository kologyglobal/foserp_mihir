export interface InvoiceDetailTab<T extends string> {
  id: T
  label: string
}

/** Tab strip shared by SI (CRM-style) and VI (Purchase-style) detail pages. */
export function InvoiceDetailTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<InvoiceDetailTab<T>>
  active: T
  onChange: (tab: T) => void
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`rounded px-2.5 py-1.5 text-[12px] ${
            active === t.id ? 'bg-slate-900 text-white' : 'text-erp-muted hover:bg-slate-100'
          }`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
