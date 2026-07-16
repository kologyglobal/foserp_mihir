import { Link } from 'react-router-dom'
import { EnterpriseRowActionsMenu } from '../enterprise/EnterpriseTablePrimitives'
import type { Enterprise360Action, Enterprise360CommAction } from './types'

export function Enterprise360CommBar({ actions }: { actions: Enterprise360CommAction[] }) {
  if (!actions.length) return null
  return (
    <div className="ent-360-comm" role="toolbar" aria-label="Communication">
      {actions.map((action) => {
        const Icon = action.icon
        const btn = (
          <button key={action.id} type="button" className="ent-360-comm__btn" onClick={action.onClick}>
            <Icon className="h-4 w-4" />
            <span>{action.label}</span>
          </button>
        )
        if (action.href) {
          return (
            <a key={action.id} href={action.href} className="ent-360-comm__btn">
              <Icon className="h-4 w-4" />
              <span>{action.label}</span>
            </a>
          )
        }
        return btn
      })}
    </div>
  )
}

export function Enterprise360ActionBar({
  primary,
  secondary,
  more,
  backHref,
  backLabel = 'Back',
}: {
  primary: Enterprise360Action[]
  secondary: Enterprise360Action[]
  more: Enterprise360Action[]
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="ent-360-actions" role="toolbar" aria-label="Record actions">
      {backHref ? (
        <Link to={backHref} className="ent-360-actions__back">
          {backLabel}
        </Link>
      ) : null}
      <div className="ent-360-actions__groups">
        <div className="ent-360-actions__primary">
          {primary.map((action) => (
            <ActionButton key={action.id} action={action} variant="primary" />
          ))}
        </div>
        <div className="ent-360-actions__secondary">
          {secondary.map((action) => (
            <ActionButton key={action.id} action={action} variant="secondary" />
          ))}
        </div>
        {more.length > 0 ? (
          <EnterpriseRowActionsMenu
            className="ent-360-actions__more"
            actions={more.map((action) => ({
              id: action.id,
              label: action.label,
              icon: action.icon,
              onClick: action.onClick ?? (() => {}),
              disabled: action.disabled,
              danger: action.danger,
            }))}
          />
        ) : null}
      </div>
    </div>
  )
}

function ActionButton({ action, variant }: { action: Enterprise360Action; variant: 'primary' | 'secondary' }) {
  const Icon = action.icon
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {action.label}
    </>
  )
  if (action.href) {
    return (
      <Link
        to={action.href}
        className={variant === 'primary' ? 'ent-360-actions__btn ent-360-actions__btn--primary' : 'ent-360-actions__btn'}
      >
        {content}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={variant === 'primary' ? 'ent-360-actions__btn ent-360-actions__btn--primary' : 'ent-360-actions__btn'}
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.disabledReason}
    >
      {content}
    </button>
  )
}
