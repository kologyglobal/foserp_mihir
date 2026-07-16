import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function SaaSQuickCreateButton({
  href = '/home',
  label = 'Quick create',
}: {
  href?: string
  label?: string
}) {
  const navigate = useNavigate()

  return (
    <button type="button" className="saas-btn-primary" onClick={() => navigate(href)}>
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}
