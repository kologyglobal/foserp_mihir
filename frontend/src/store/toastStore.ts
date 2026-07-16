import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, variant?: ToastVariant) => string
  dismiss: (id: string) => void
  clear: () => void
}

const MAX_TOASTS = 4

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((s) => {
      // Collapse duplicates of the same alert (repeated Save clicks)
      const withoutDupes = s.toasts.filter((t) => !(t.message === message && t.variant === variant))
      return {
        toasts: [...withoutDupes, { id, message, variant }].slice(-MAX_TOASTS),
      }
    })
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/** App-wide transaction alerts — success / failed / warning / info (top-right toasts) */
export const notify = {
  success: (message: string) => useToastStore.getState().push(message, 'success'),
  error: (message: string) => useToastStore.getState().push(message, 'error'),
  failed: (message: string) => useToastStore.getState().push(message, 'error'),
  warning: (message: string) => useToastStore.getState().push(message, 'warning'),
  info: (message: string) => useToastStore.getState().push(message, 'info'),
}

/** Master create/update confirmation */
export function notifyMasterSaved(entityLabel: string, isNew: boolean) {
  notify.success(isNew ? `${entityLabel} created` : `${entityLabel} saved`)
}
