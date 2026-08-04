import { Sparkles } from 'lucide-react'
import { NotificationBell } from '../design-system/NotificationPanel'
import { UserMenuDropdown } from './UserMenuDropdown'
import { useUIStore } from '../../store/uiStore'

/**
 * Compact global tools for the workspace page header.
 */
export function WorkspaceChromeToolbar() {
  const openCopilot = useUIStore((s) => s.openCopilot)
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="d365-workspace-chrome-toolbar" aria-label="Workspace tools">
      <span className="d365-workspace-chrome-toolbar__date" title={today}>
        {today}
      </span>

      <button
        type="button"
        className="d365-workspace-chrome-toolbar__icon"
        onClick={openCopilot}
        aria-label="Open Copilot"
        title="Copilot (Ctrl+.)"
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <NotificationBell className="d365-workspace-chrome-toolbar__icon" />

      <UserMenuDropdown variant="default" className="d365-workspace-chrome-toolbar__user" />
    </div>
  )
}
