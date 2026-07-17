import { useConfirmDialogStore, type SystemConfirmVariant } from '@/store/confirmDialogStore'

export type SystemConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: SystemConfirmVariant
}

/**
 * In-app confirmation dialog (replaces `window.confirm`).
 * Resolves `true` when the user confirms, `false` on cancel / dismiss.
 */
export function systemConfirm(options: SystemConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmDialogStore.getState().open({
      kind: 'confirm',
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      variant: options.variant ?? 'default',
      alertOnly: false,
      resolve,
    })
  })
}

/**
 * In-app alert dialog (replaces `window.alert`).
 * Prefer `notify.*` for transient feedback; use this when the user must acknowledge a message.
 */
export function systemAlert(options: {
  title: string
  description?: string
  confirmLabel?: string
}): Promise<void> {
  return new Promise((resolve) => {
    useConfirmDialogStore.getState().open({
      kind: 'confirm',
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: 'OK',
      variant: 'default',
      alertOnly: true,
      resolve: () => resolve(),
    })
  })
}

export type SystemPromptOptions = {
  title: string
  description?: string
  fieldLabel?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: SystemConfirmVariant
  /** When true (default), empty submit is blocked. */
  required?: boolean
}

/**
 * In-app text prompt (replaces `window.prompt`).
 * Resolves the trimmed string on confirm, or `null` on cancel / dismiss.
 */
export function systemPrompt(options: SystemPromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useConfirmDialogStore.getState().open({
      kind: 'prompt',
      title: options.title,
      description: options.description,
      fieldLabel: options.fieldLabel,
      placeholder: options.placeholder,
      defaultValue: options.defaultValue ?? '',
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      variant: options.variant ?? 'default',
      required: options.required !== false,
      resolve,
    })
  })
}
