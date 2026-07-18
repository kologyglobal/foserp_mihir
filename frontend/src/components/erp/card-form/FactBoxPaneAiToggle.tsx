import { Sparkles } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { useFactBoxPane } from './FactBoxPaneContext'

/** Reopen collapsed Smart Context — always rendered above form sections (see smart-context-restore rule). */
export function FactBoxPaneAiToggle({ className }: { className?: string }) {
  const ctx = useFactBoxPane()
  if (!ctx?.collapsible || ctx.open) return null

  return (
    <button
      type="button"
      className={cn('erp-factbox-pane__ai-toggle', className)}
      onClick={() => ctx.setOpen(true)}
      aria-label={`Show ${ctx.label}`}
      title={`Show ${ctx.label}`}
    >
      <Sparkles className="h-4 w-4" aria-hidden />
    </button>
  )
}
