import { ConfirmDialog } from './ConfirmDialog'
import { useAppConfirmDialogStore } from '../../store/confirmDialogStore'

/** Mount once at app root — powers `appConfirm` / `appPromptNote`. */
export function ConfirmDialogHost() {
  const open = useAppConfirmDialogStore((s) => s.open)
  const request = useAppConfirmDialogStore((s) => s.request)
  const closeWith = useAppConfirmDialogStore((s) => s.closeWith)

  return (
    <ConfirmDialog
      open={open}
      request={request}
      onCancel={() => closeWith({ confirmed: false })}
      onConfirm={(note) => closeWith({ confirmed: true, note })}
    />
  )
}
