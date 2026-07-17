import { create } from 'zustand'

export type SystemConfirmVariant = 'default' | 'danger'

type BaseDialog = {
  id: string
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  variant: SystemConfirmVariant
}

export type SystemConfirmRequest = BaseDialog & {
  kind: 'confirm'
  alertOnly?: boolean
  resolve: (confirmed: boolean) => void
}

export type SystemPromptRequest = BaseDialog & {
  kind: 'prompt'
  fieldLabel?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  resolve: (value: string | null) => void
}

export type SystemDialogRequest = SystemConfirmRequest | SystemPromptRequest

/** Distributive omit — plain `Omit<Union, 'id'>` collapses to shared keys only. */
export type OpenSystemDialogRequest =
  | Omit<SystemConfirmRequest, 'id'>
  | Omit<SystemPromptRequest, 'id'>

type DialogState = {
  current: SystemDialogRequest | null
  open: (req: OpenSystemDialogRequest) => void
  closeConfirm: (confirmed: boolean) => void
  closePrompt: (value: string | null) => void
}

export const useConfirmDialogStore = create<DialogState>((set, get) => ({
  current: null,
  open: (req) => {
    const prev = get().current
    if (prev) {
      if (prev.kind === 'confirm') prev.resolve(false)
      else prev.resolve(null)
    }
    const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const current: SystemDialogRequest =
      req.kind === 'confirm'
        ? { ...req, id }
        : { ...req, id }
    set({ current })
  },
  closeConfirm: (confirmed) => {
    const cur = get().current
    if (!cur || cur.kind !== 'confirm') return
    cur.resolve(confirmed)
    set({ current: null })
  },
  closePrompt: (value) => {
    const cur = get().current
    if (!cur || cur.kind !== 'prompt') return
    cur.resolve(value)
    set({ current: null })
  },
}))
