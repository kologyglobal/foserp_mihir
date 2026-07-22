import type { ProductionAssignment } from '@/types/manufacturingPhase2b'
import { t } from '../i18n/operatorStrings'
import { operatorBtnDanger, operatorBtnPrimary, operatorBtnSecondary, operatorBtnWarning } from './operatorCss'

interface OperatorTaskActionsProps {
  assignment: ProductionAssignment
  busy?: boolean
  onAccept: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onComplete: () => void
  onReportProblem: () => void
}

/** Large touch-target operator lifecycle actions driven by backend allowedActions. */
export function OperatorTaskActions({
  assignment,
  busy,
  onAccept,
  onStart,
  onPause,
  onResume,
  onComplete,
  onReportProblem,
}: OperatorTaskActionsProps) {
  const actions = assignment.allowedActions
  if (!actions) return null

  return (
    <div className="flex flex-wrap gap-2">
      {actions.accept ? (
        <button type="button" className={operatorBtnSecondary} disabled={busy} onClick={onAccept}>
          {t('action.accept')}
        </button>
      ) : null}
      {actions.start ? (
        <button type="button" className={operatorBtnPrimary} disabled={busy} onClick={onStart}>
          {t('action.start')}
        </button>
      ) : null}
      {actions.pause ? (
        <button type="button" className={operatorBtnWarning} disabled={busy} onClick={onPause}>
          {t('action.pause')}
        </button>
      ) : null}
      {actions.resume ? (
        <button type="button" className={operatorBtnPrimary} disabled={busy} onClick={onResume}>
          {t('action.resume')}
        </button>
      ) : null}
      {actions.complete ? (
        <button type="button" className={operatorBtnPrimary} disabled={busy} onClick={onComplete}>
          {t('action.complete')}
        </button>
      ) : null}
      <button type="button" className={operatorBtnDanger} disabled={busy} onClick={onReportProblem}>
        {t('action.reportProblem')}
      </button>
    </div>
  )
}
