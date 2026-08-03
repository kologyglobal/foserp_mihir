import { NotificationBell } from '../design-system/NotificationPanel'
import { UserMenuDropdown } from './UserMenuDropdown'

/**
 * Compact global tools for the workspace page header.
 */
export function WorkspaceChromeToolbar() {
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

      <NotificationBell className="d365-workspace-chrome-toolbar__icon" />

      <UserMenuDropdown variant="default" className="d365-workspace-chrome-toolbar__user" />
    </div>
  )
}
