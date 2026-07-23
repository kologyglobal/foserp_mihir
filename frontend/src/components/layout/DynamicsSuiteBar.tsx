import { LayoutGrid, Menu, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { GlobalSearchTrigger } from '../design-system/GlobalSearch'
import { NotificationBell } from '../design-system/NotificationPanel'
import { UserMenuDropdown } from './UserMenuDropdown'

/** Full-width Dynamics 365 suite bar */
export function DynamicsSuiteBar() {
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

        <button
          type="button"
          className="d365-suite-icon-btn md:hidden"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <NotificationBell className="d365-suite-icon-btn d365-suite-notify border-0 bg-transparent shadow-none hover:bg-white/10 hover:text-white" />
        <UserMenuDropdown variant="suite" />
      </div>
    </header>
  )
}
