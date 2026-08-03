import { Sparkles } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

/**
 * Always-on Copilot entry. Shown even if suite-bar chrome is missed or HMR lags.
 * Icon-only FAB; positioned above sticky form action bars via CSS.
 */
export function KnowledgeCopilotFab() {
  const open = useUIStore((s) => s.copilotOpen)
  const openCopilot = useUIStore((s) => s.openCopilot)
  if (open) return null

  return (
    <button
      type="button"
      className="kb-copilot-fab"
      onClick={openCopilot}
      aria-label="Open Copilot"
      title="Copilot (Ctrl+.)"
    >
      <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  )
}
