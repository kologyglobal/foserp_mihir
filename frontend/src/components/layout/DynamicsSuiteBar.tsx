import { HelpCircle, LayoutGrid, Menu, Search, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { GlobalSearchTrigger } from '../design-system/GlobalSearch'
import { NotificationBell } from '../design-system/NotificationPanel'
import { RoleSwitcher } from '../role-experience/RoleSwitcher'
import { UserMenuDropdown } from './UserMenuDropdown'
import { CrmQuickCreateMenu } from '../crm/quick-create/CrmQuickCreateMenu'

/** Full-width Dynamics 365 suite bar */
export function DynamicsSuiteBar() {
  const navigate = useNavigate()
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav)
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <header className="d365-suite-bar" role="banner">
      <div className="d365-suite-leading">
        <button
          type="button"
          className="d365-suite-icon-btn md:hidden"
          onClick={toggleMobileNav}
          aria-label="Open modules menu"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <Link to="/home" className="d365-suite-waffle hidden md:flex" title="App launcher" aria-label="App launcher">
          <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        <Link to="/home" className="d365-suite-brand" title="Go to home">
          <span className="d365-suite-title hidden sm:inline">FOS ERP</span>
        </Link>
      </div>

      <div className="d365-suite-search hidden md:block">
        <GlobalSearchTrigger variant="suite" />
      </div>

      <div className="d365-suite-actions">
        <span className="d365-suite-date hidden 2xl:inline">{today}</span>

        <CrmQuickCreateMenu variant="suite" />

        <button
          type="button"
          className="d365-suite-icon-btn md:hidden"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <RoleSwitcher variant="suite" className="hidden sm:flex" />
        <NotificationBell className="d365-suite-icon-btn d365-suite-notify border-0 bg-transparent shadow-none hover:bg-white/10 hover:text-white" />
        <button
          type="button"
          className="d365-suite-icon-btn hidden sm:flex"
          aria-label="Settings"
          title="Settings"
          onClick={() => navigate('/settings')}
        >
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" className="d365-suite-icon-btn hidden md:flex" aria-label="Help" title="Help">
          <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <UserMenuDropdown variant="suite" />
      </div>
    </header>
  )
}
