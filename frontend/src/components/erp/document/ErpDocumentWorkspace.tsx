import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useErpCardFormKeyboard } from '../card-form/useErpCardFormKeyboard'
import { cn } from '../../../utils/cn'
import '../../../styles/erp-document.css'

export type ErpDocCommandAction = {
  id: string
  label: string
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  title?: string
}

export type ErpDocLifecycleStep = {
  id: string
  label: string
  state: 'pending' | 'current' | 'done'
}

export type ErpDocInfoItem = { label: string; value: ReactNode }

export type ErpDocTab = { id: string; label: string }

type ErpDocumentWorkspaceProps = {
  backLabel: string
  backTo: string
  documentNo: string
  statusLabel: string
  statusTone?: 'draft' | 'submitted' | 'approved' | 'converted' | 'default'
  lifecycle: ErpDocLifecycleStep[]
  infoStrip: ErpDocInfoItem[]
  commandActions: ErpDocCommandAction[]
  tabs: ErpDocTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  main: ReactNode
  factBoxes: ReactNode
  footerActions: ErpDocCommandAction[]
  footerHint?: string
  onSave?: () => void
  onSaveClose?: () => void
  onCancel?: () => void
  /** Create/new document — tighter chrome */
  variant?: 'create' | 'document'
  showLifecycle?: boolean
  tabBadges?: Record<string, ReactNode>
  onAddLine?: () => void
}

export function ErpDocumentWorkspace({
  backLabel,
  backTo,
  documentNo,
  statusLabel,
  statusTone = 'default',
  lifecycle,
  infoStrip,
  commandActions,
  tabs,
  activeTab,
  onTabChange,
  main,
  factBoxes,
  footerActions,
  footerHint,
  onSave,
  onSaveClose,
  onCancel,
  variant = 'document',
  showLifecycle = true,
  tabBadges,
  onAddLine,
}: ErpDocumentWorkspaceProps) {
  useErpCardFormKeyboard({
    onSave,
    onSaveClose,
    onCancel,
    onAddLine,
  })

  const isCreate = variant === 'create'

  return (
    <div className={cn('erp-doc', isCreate && 'erp-doc--create')}>
      <div className="erp-doc__command">
        <Link to={backTo} className="erp-doc__command-back">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="erp-doc__command-title">
          <span className="erp-doc__docno">{documentNo}</span>
          <span className={cn('erp-doc__status', `erp-doc__status--${statusTone}`)}>{statusLabel}</span>
        </div>
        <div className="erp-doc__command-actions">
          {commandActions.map((a) => (
            <button
              key={a.id}
              type="button"
              className={cn('erp-doc__cmd-btn', a.primary && 'erp-doc__cmd-btn--primary')}
              disabled={a.disabled}
              title={a.title}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {showLifecycle ? (
        <div className="erp-doc__lifecycle" aria-label="Document lifecycle">
          {lifecycle.map((step, i) => (
            <span key={step.id} className="inline-flex items-center">
              {i > 0 ? <span className="erp-doc__lifecycle-sep">│</span> : null}
              <span
                className={cn(
                  'erp-doc__lifecycle-step',
                  step.state === 'current' && 'erp-doc__lifecycle-step--current',
                  step.state === 'done' && 'erp-doc__lifecycle-step--done',
                )}
              >
                {step.label}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="erp-doc__info-strip">
        {infoStrip.map((item) => (
          <div key={item.label} className="erp-doc__info-item">
            <span className="erp-doc__info-label">{item.label}</span>
            <span className="erp-doc__info-value">{item.value}</span>
          </div>
        ))}
      </div>

      <nav className="erp-doc__tabs" aria-label="Document sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn('erp-doc__tab', activeTab === tab.id && 'erp-doc__tab--active')}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tabBadges?.[tab.id] != null ? (
              <span className="erp-doc__tab-badge">{tabBadges[tab.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="erp-doc__body">
        <div className="erp-doc__main">{main}</div>
        <aside className="erp-doc__rail">{factBoxes}</aside>
      </div>

      <footer className="erp-doc__footer">
        {footerHint ? <span className="erp-doc__footer-hint">{footerHint}</span> : <span />}
        <div className="erp-doc__footer-actions">
          {footerActions.map((a) => (
            <button
              key={a.id}
              type="button"
              className={cn('erp-doc__cmd-btn', a.primary && 'erp-doc__cmd-btn--primary')}
              disabled={a.disabled}
              title={a.title}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}

export function ErpDocFastTab({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="erp-doc__fasttab">
      <button type="button" className="erp-doc__fasttab-header" onClick={onToggle} aria-expanded={open}>
        <span>{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open ? <div className="erp-doc__fasttab-body">{children}</div> : null}
    </div>
  )
}

export function ErpDocCompactGrid({ children }: { children: ReactNode }) {
  return <div className="erp-doc__compact-grid">{children}</div>
}

export function ErpDocField({
  label,
  children,
  readOnlyValue,
}: {
  label: string
  children?: ReactNode
  readOnlyValue?: ReactNode
}) {
  return (
    <div className="erp-doc__field">
      <span className="erp-doc__field-label">{label}</span>
      <div className="erp-doc__field-control">
        {readOnlyValue != null ? (
          <span className="erp-doc__field-readonly">{readOnlyValue}</span>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function ErpDocAssistField({
  label,
  children,
  onAssist,
  assist = true,
}: {
  label: string
  children: ReactNode
  onAssist?: () => void
  assist?: boolean
}) {
  return (
    <div className="erp-doc__field">
      <span className="erp-doc__field-label">{label}</span>
      <div className="erp-doc__field-control">
        {children}
        {assist ? (
          <button
            type="button"
            className="erp-doc__assist-btn"
            onClick={onAssist}
            title="Assist edit (F4)"
            tabIndex={-1}
          >
            …
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Horizontal essentials strip for create-mode data entry */
export function ErpDocEssentialsStrip({ children }: { children: ReactNode }) {
  return <div className="erp-doc__essentials">{children}</div>
}

export function ErpDocEssentialField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="erp-doc__essential-field">
      <span className="erp-doc__essential-label">{label}</span>
      <div className="erp-doc__essential-control">{children}</div>
    </label>
  )
}

export function ErpDocRailBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="erp-doc-rail-box">
      <div className="erp-doc-rail-box__title">{title}</div>
      <div className="erp-doc-rail-box__body">{children}</div>
    </div>
  )
}

export function ErpDocRailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="erp-doc-rail-row">
      <span className="text-[#605e5c]">{label}</span>
      <span className="font-semibold text-[#242424]">{value}</span>
    </div>
  )
}
