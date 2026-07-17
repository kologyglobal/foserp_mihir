import { create } from 'zustand'

/* ── System confirm / prompt (systemConfirm.ts + SystemConfirmDialogHost) ── */

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

type SystemDialogState = {
  current: SystemDialogRequest | null
  open: (req: OpenSystemDialogRequest) => void
  closeConfirm: (confirmed: boolean) => void
  closePrompt: (value: string | null) => void
}

export const useConfirmDialogStore = create<SystemDialogState>((set, get) => ({
  current: null,
  open: (req) => {
    const prev = get().current
    if (prev) {
      if (prev.kind === 'confirm') prev.resolve(false)
      else prev.resolve(null)
    }
    const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const current: SystemDialogRequest =
      req.kind === 'confirm' ? { ...req, id } : { ...req, id }
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

/* ── App confirm / notes (ConfirmDialogHost + purchase flows) ── */

export type ConfirmDialogTone = 'default' | 'danger' | 'warning' | 'success'

export type ConfirmDialogNoteOptions = {
  /** Show a notes textarea. */
  enabled?: boolean
  /** Block confirm until note has non-whitespace content. */
  required?: boolean
  label?: string
  placeholder?: string
  /** Prefill value. */
  defaultValue?: string
  rows?: number
  /** Soft character hint (not hard max). */
  maxLength?: number
}

export type ConfirmDialogRequest = {
  title: string
  description?: string
  /** Extra context line under description (e.g. document number). */
  detail?: string
  tone?: ConfirmDialogTone
  confirmLabel?: string
  cancelLabel?: string
  note?: ConfirmDialogNoteOptions
}

export type ConfirmDialogResult =
  | { confirmed: false }
  | { confirmed: true; note: string }

type Resolver = (result: ConfirmDialogResult) => void

type AppConfirmDialogState = {
  open: boolean
  request: ConfirmDialogRequest | null
  resolve: Resolver | null
  openDialog: (request: ConfirmDialogRequest) => Promise<ConfirmDialogResult>
  closeWith: (result: ConfirmDialogResult) => void
}

export const useAppConfirmDialogStore = create<AppConfirmDialogState>((set, get) => ({
  open: false,
  request: null,
  resolve: null,
  openDialog: (request) =>
    new Promise<ConfirmDialogResult>((resolve) => {
      const prev = get().resolve
      if (prev) prev({ confirmed: false })
      set({ open: true, request, resolve })
    }),
  closeWith: (result) => {
    const { resolve } = get()
    set({ open: false, request: null, resolve: null })
    resolve?.(result)
  },
}))

/** Imperative confirm — replaces `window.confirm`. */
export async function appConfirm(
  request: Omit<ConfirmDialogRequest, 'note'> & { note?: never },
): Promise<boolean> {
  const result = await useAppConfirmDialogStore.getState().openDialog(request)
  return result.confirmed
}

/**
 * Confirm with optional/required notes — replaces `window.prompt` for comments.
 * Returns `null` if cancelled; otherwise trimmed note string (may be empty if not required).
 */
export async function appPromptNote(
  request: ConfirmDialogRequest & { note?: ConfirmDialogNoteOptions },
): Promise<string | null> {
  const note = {
    enabled: true,
    required: request.note?.required ?? true,
    label: request.note?.label ?? 'Comments',
    placeholder: request.note?.placeholder,
    defaultValue: request.note?.defaultValue,
    rows: request.note?.rows ?? 4,
    maxLength: request.note?.maxLength,
  }
  const result = await useAppConfirmDialogStore.getState().openDialog({
    ...request,
    note,
  })
  if (!result.confirmed) return null
  return result.note
}

/** Full result API when you need both confirm + note. */
export function appConfirmDialog(request: ConfirmDialogRequest): Promise<ConfirmDialogResult> {
  return useAppConfirmDialogStore.getState().openDialog(request)
}
