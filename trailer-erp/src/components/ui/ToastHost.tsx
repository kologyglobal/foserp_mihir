import { useEffect } from 'react'
import { useToastStore, type ToastItem } from '../../store/toastStore'
import { Toast } from './Toast'

const AUTO_DISMISS_MS: Record<ToastItem['variant'], number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
}

function ToastItemHost({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS[item.variant])
    return () => window.clearTimeout(timer)
  }, [dismiss, item.id, item.variant])

  return (
    <Toast
      message={item.message}
      variant={item.variant}
      floating={false}
      onDismiss={() => dismiss(item.id)}
    />
  )
}

/** Global stack for transaction success / failed / warning alerts */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[200] flex max-w-[min(100vw-2rem,24rem)] flex-col gap-2 sm:top-5 sm:right-5">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItemHost item={item} />
        </div>
      ))}
    </div>
  )
}
