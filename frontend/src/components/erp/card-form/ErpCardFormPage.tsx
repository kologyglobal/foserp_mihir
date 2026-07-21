import { useCallback, useState } from 'react'
import { Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { useWorkspacePageHeaderSetters } from '../../../context/WorkspacePageHeaderContext'
import { buildRouteBreadcrumbs } from '../../../utils/pageNavigation'
import { useUIStore } from '../../../store/uiStore'
import { ErpCardTabs } from './ErpCardTabs'
import { ErpFactBoxPane } from './ErpFactBoxPane'
import { FactBoxPaneAiToggle } from './FactBoxPaneAiToggle'
import { FactBoxPaneProvider } from './FactBoxPaneContext'
import { ErpFormStatusStrip } from './ErpFormStatusStrip'
import { ErpFormValidationSummary } from './ErpFormValidationSummary'
import { useErpCardFormPageKeyboard } from './useErpCardFormKeyboard'
import { getFactBoxInitialOpen } from './factBoxOpenDefaults'
import type { ErpCardFormPageProps } from './types'
import { cn } from '../../../utils/cn'

/**
 * Business Central–style ERP card form page shell.
 * Composes: header → command bar → status strip → tabs → main + factbox → subpage → form footer.
 */
export function ErpCardFormPage({
  title,
  description,
  recordNo,
  badge = 'ERP',
  statusChip,
  favoritePath,
  breadcrumbs,
  autoBreadcrumbs = false,
  variant = 'dynamics',
  insights,
  commandBar,
  actionRow,
  statusStrip = [],
  statusStripExtra,
  tabs,
  activeTab: controlledTab,
  onTabChange,
  validationErrors,
  lockedReason,
  onSubmit,
  formId = 'erp-card-form',
  children,
  factBox,
  subpage,
  footer,
  stickyFooter = false,
  collapsibleFactBox = false,
  factBoxLabel = 'Smart Context',
  factBoxSubtitle,
  factBoxStorageKey,
  factBoxOpen: controlledFactBoxOpen,
  onFactBoxOpenChange,
  className,
  enableKeyboardShortcuts = true,
  onSaveShortcut,
  onSaveCloseShortcut,
  onSaveAndNewShortcut,
  workspaceRecordHeader = false,
  backLink,
}: ErpCardFormPageProps) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const favPath = favoritePath ?? pathname
  const fav = isFavorite(favPath)
  /** Setters-only — do not subscribe to header state (avoids setHeader → re-render loops). */
  const workspaceHeaderSetters = useWorkspacePageHeaderSetters()
  const isEnterprise = variant === 'dynamics'
  const mergeHeader = isEnterprise && Boolean(workspaceHeaderSetters)
  const factBoxPaneKey = factBoxStorageKey ?? (collapsibleFactBox ? `erp-factbox:${pathname}` : undefined)
  const [internalFactBoxOpen, setInternalFactBoxOpenState] = useState(() => {
    if (!collapsibleFactBox || !factBoxPaneKey) return true
    return getFactBoxInitialOpen(factBoxPaneKey)
  })

  const factBoxOpen = controlledFactBoxOpen ?? internalFactBoxOpen

  const setFactBoxOpen = useCallback((next: boolean) => {
    if (controlledFactBoxOpen === undefined) {
      setInternalFactBoxOpenState(next)
      if (factBoxPaneKey) {
        try {
          sessionStorage.setItem(factBoxPaneKey, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }
    }
    onFactBoxOpenChange?.(next)
  }, [controlledFactBoxOpen, onFactBoxOpenChange, factBoxPaneKey])

  const factBoxCollapsed = Boolean(collapsibleFactBox && factBox && !factBoxOpen)

  const [internalTab, setInternalTab] = useState(tabs?.[0]?.id ?? 'home')
  const activeTab = controlledTab ?? internalTab

  function handleTabChange(tabId: string) {
    if (!controlledTab) setInternalTab(tabId)
    onTabChange?.(tabId)
  }

  useErpCardFormPageKeyboard({ enableKeyboardShortcuts, onSaveShortcut, onSaveCloseShortcut, onSaveAndNewShortcut })

  const crumbItems = breadcrumbs ?? (autoBreadcrumbs ? buildRouteBreadcrumbs(pathname) : undefined)

  const headerRecordNo =
    recordNo && recordNo !== 'New' && !/^auto/i.test(recordNo) ? recordNo : undefined

  const headerActions = workspaceRecordHeader
    ? null
    : mergeHeader
      ? (
          headerRecordNo || statusChip ? (
            <div className="erp-card-form-page__header-actions erp-card-form-page__header-actions--merged">
              {headerRecordNo ? <span className="erp-card-form-page__record-no">{headerRecordNo}</span> : null}
              {statusChip}
            </div>
          ) : null
        )
      : (
          <div className="erp-card-form-page__header-actions">
            {recordNo ? <span className="erp-card-form-page__record-no">{recordNo}</span> : null}
            {statusChip}
            <button
              type="button"
              className={cn('erp-card-form-page__favorite', fav && 'erp-card-form-page__favorite--on')}
              onClick={() => toggleFavorite({ path: favPath, label: title })}
              aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={cn('h-4 w-4', fav && 'fill-current')} />
            </button>
          </div>
        )

  const showSplitLayout = Boolean(factBox && (!collapsibleFactBox || factBoxOpen))

  const factBoxContent = factBox ? (
    collapsibleFactBox ? (
      <ErpFactBoxPane
        label={factBoxLabel}
        subtitle={factBoxSubtitle}
        open={factBoxOpen}
        onOpenChange={setFactBoxOpen}
      >
        {factBox}
      </ErpFactBoxPane>
    ) : (
      factBox
    )
  ) : null

  return (
    <OperationalPageShell
      title={title}
      description={description}
      badge={badge}
      variant={variant}
      breadcrumbs={crumbItems}
      autoBreadcrumbs={false}
      favoritePath={favPath}
      insights={insights}
      className={cn(
        'erp-card-form-page',
        factBoxCollapsed && 'erp-card-form-page--factbox-collapsed',
        className,
      )}
      commandBar={commandBar}
      actions={headerActions}
      workspaceRecordHeader={workspaceRecordHeader}
      backLink={backLink}
    >
      {actionRow ? <div className="erp-card-form-page__action-row">{actionRow}</div> : null}

      <ErpFormStatusStrip items={statusStrip} extra={statusStripExtra} />

      {tabs && tabs.length > 0 ? (
        <ErpCardTabs tabs={tabs} active={activeTab} onChange={handleTabChange} />
      ) : null}

      <form
        id={formId}
        onSubmit={onSubmit}
        className="erp-card-form-page__form erp-form-shell-body flex min-h-0 flex-col"
      >
        <ErpFormValidationSummary errors={validationErrors} lockedReason={lockedReason} className="mb-3" />

        <FactBoxPaneProvider
          open={factBoxOpen}
          collapsible={Boolean(collapsibleFactBox && factBox)}
          label={factBoxLabel}
          setOpen={setFactBoxOpen}
        >
          {factBoxCollapsed ? (
            <div className="erp-card-form-page__context-restore" role="toolbar" aria-label="Smart context">
              <FactBoxPaneAiToggle />
            </div>
          ) : null}

          <div
            className={cn(
              'erp-card-form-page__body erp-form-shell-content erp-form-shell-content--padded min-h-0',
              stickyFooter
                ? 'erp-card-form-page__body--sticky-footer flex-1 overflow-y-auto'
                : 'pb-4',
            )}
          >
            <div
              className="erp-card-form-page__layout-wrap"
              data-factbox-open={showSplitLayout ? 'true' : factBox && collapsibleFactBox ? 'false' : undefined}
            >
              <div
                className={cn(
                  'erp-card-form-page__layout',
                  showSplitLayout && 'erp-card-form-page__layout--with-factbox',
                  factBoxCollapsed && 'erp-card-form-page__layout--factbox-collapsed',
                )}
              >
                <div className="erp-card-form-page__main min-w-0">{children}</div>
                {showSplitLayout && factBoxContent ? (
                  <div className="erp-card-form-page__factbox min-w-0">{factBoxContent}</div>
                ) : null}
              </div>
            </div>
            {subpage ? <div className="erp-card-form-page__subpage mt-4">{subpage}</div> : null}
          </div>
        </FactBoxPaneProvider>

        {footer ? (
          <div className={cn(stickyFooter && 'erp-card-form-page__footer-sticky', !stickyFooter && 'erp-card-form-page__footer-inline')}>
            {footer}
          </div>
        ) : null}
      </form>
    </OperationalPageShell>
  )
}
