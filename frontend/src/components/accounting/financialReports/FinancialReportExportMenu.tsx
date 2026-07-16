import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, FileSpreadsheet, FileText, FileType, Printer } from 'lucide-react'
import { cn } from '@/utils/cn'
import { notify } from '@/store/toastStore'

export type FinancialReportExportFormat = 'excel' | 'csv' | 'pdf'

const FORMAT_OPTIONS: {
  id: FinancialReportExportFormat
  label: string
  icon: typeof FileSpreadsheet
}[] = [
  { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', icon: FileText },
  { id: 'pdf', label: 'PDF', icon: FileType },
]

export function FinancialReportExportMenu({
  onExport,
  onPrint,
  showDemoDisclaimer = true,
  disabled,
  className,
  label = 'Export',
}: {
  onExport?: (format: FinancialReportExportFormat) => void
  onPrint?: () => void
  /** When true, shows an info toast on first export/print if parent does not handle demo messaging */
  showDemoDisclaimer?: boolean
  disabled?: boolean
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const demoNotifiedRef = useRef(false)

  const positionMenu = useCallback(() => {
    const trigger = rootRef.current
    const menu = menuRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = Math.max(menu?.offsetWidth ?? 0, 168)
    const menuHeight = menu?.offsetHeight ?? 140
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const openUp = menuHeight > spaceBelow && rect.top > spaceBelow
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))

    setMenuStyle({
      position: 'fixed',
      left,
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      transform: openUp ? 'translateY(-100%)' : undefined,
      zIndex: 10050,
      minWidth: 168,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    positionMenu()
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
    return () => {
      window.removeEventListener('scroll', positionMenu, true)
      window.removeEventListener('resize', positionMenu)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function maybeNotifyDemo() {
    if (showDemoDisclaimer && !demoNotifiedRef.current) {
      demoNotifiedRef.current = true
      notify.info('Demo export — no file is written to disk in this build.')
    }
  }

  function handleExport(format: FinancialReportExportFormat) {
    setOpen(false)
    maybeNotifyDemo()
    onExport?.(format)
  }

  function handlePrint() {
    setOpen(false)
    maybeNotifyDemo()
    onPrint?.()
  }

  const hasActions = Boolean(onExport || onPrint)

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <div className="inline-flex rounded-md shadow-sm">
        <button
          type="button"
          disabled={disabled || !hasActions}
          className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-r-none border-r-0 px-3 text-[12px] font-semibold"
          onClick={() => onExport?.('excel')}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {label}
        </button>
        <button
          type="button"
          disabled={disabled || !hasActions}
          aria-expanded={open}
          aria-haspopup="menu"
          className="erp-btn erp-btn-secondary inline-flex h-8 items-center rounded-l-none px-2"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && hasActions
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="rounded-md border border-erp-border bg-white py-1 shadow-lg"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  disabled={!onExport}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-erp-text hover:bg-erp-surface-alt disabled:opacity-50"
                  onClick={() => handleExport(opt.id)}
                >
                  <opt.icon className="h-3.5 w-3.5 text-erp-muted" />
                  {opt.label}
                </button>
              ))}
              {onPrint ? (
                <>
                  <div className="my-1 border-t border-erp-border" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-erp-text hover:bg-erp-surface-alt"
                    onClick={handlePrint}
                  >
                    <Printer className="h-3.5 w-3.5 text-erp-muted" />
                    Print
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
