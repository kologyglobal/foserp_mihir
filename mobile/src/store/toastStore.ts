import { create } from 'zustand'

export type ToastTone = 'success' | 'warning' | 'danger' | 'info'

export type ToastPayload = {
  id: number
  message: string
  tone: ToastTone
  durationMs: number
}

type ToastState = {
  toast: ToastPayload | null
  show: (message: string, tone?: ToastTone, durationMs?: number) => void
  hide: () => void
}

let seq = 0

function defaultDuration(tone: ToastTone): number {
  if (tone === 'danger') return 3500
  if (tone === 'warning') return 2800
  return 1800
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'info', durationMs) => {
    seq += 1
    set({
      toast: {
        id: seq,
        message,
        tone,
        durationMs: durationMs ?? defaultDuration(tone),
      },
    })
  },
  hide: () => set({ toast: null }),
}))

/** Imperative toast API — works from async handlers without hooks. */
export function showToast(
  message: string,
  tone: ToastTone = 'info',
  durationMs?: number,
): void {
  useToastStore.getState().show(message, tone, durationMs)
}
