import { Link } from 'react-router-dom'

export type FioriBreadcrumbItem = {
  label: string
  href?: string
}

export function FioriBreadcrumb({ items }: { items: FioriBreadcrumbItem[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb">
      <ol className="fiori-breadcrumb">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} aria-current={isLast ? 'page' : undefined}>
              {item.href && !isLast ? <Link to={item.href}>{item.label}</Link> : item.label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
