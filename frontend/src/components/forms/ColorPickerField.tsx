import { useId, useRef } from 'react'
import { cn } from '../../utils/cn'
import { Input } from './Inputs'

const DEFAULT_PRESETS = [
  '#0078D4',
  '#00B7C3',
  '#8764B8',
  '#498205',
  '#107C10',
  '#CA5010',
  '#D13438',
  '#605E5C',
  '#8A94A6',
  '#FFB900',
  '#E3008C',
  '#00188F',
] as const

export function normalizeHexColor(value: string | undefined | null): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split('').map((c) => c + c).join('').toUpperCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }
  return null
}

export function ColorSwatch({
  color,
  size = 'md',
  className,
}: {
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const normalized = normalizeHexColor(color) ?? '#CBD5E1'
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <span
      className={cn('inline-block shrink-0 rounded-md border border-black/10 shadow-sm', sizeClass, className)}
      style={{ backgroundColor: normalized }}
      aria-hidden
    />
  )
}

export function ColorPickerField({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
}: {
  value: string
  onChange: (value: string) => void
  presets?: readonly string[]
  className?: string
}) {
  const inputId = useId()
  const nativeRef = useRef<HTMLInputElement>(null)
  const normalized = normalizeHexColor(value) ?? ''

  const applyColor = (next: string) => {
    const hex = normalizeHexColor(next)
    onChange(hex ?? next.trim())
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-erp-border bg-erp-surface shadow-sm transition hover:border-erp-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-erp-primary"
          onClick={() => nativeRef.current?.click()}
          aria-label="Open color picker"
        >
          <span
            className="absolute inset-1 rounded-md"
            style={{ backgroundColor: normalized || '#E2E8F0' }}
          />
          <span className="sr-only">Pick color</span>
        </button>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => applyColor(e.target.value)}
          placeholder="#0078D4"
          className="font-mono uppercase"
          spellCheck={false}
          maxLength={7}
        />
        <input
          ref={nativeRef}
          type="color"
          className="sr-only"
          value={normalized || '#0078D4'}
          onChange={(e) => applyColor(e.target.value)}
          tabIndex={-1}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const hex = normalizeHexColor(preset) ?? preset
          const selected = normalized === hex
          return (
            <button
              key={preset}
              type="button"
              title={hex}
              aria-label={`Use ${hex}`}
              className={cn(
                'h-7 w-7 rounded-md border transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-erp-primary',
                selected ? 'border-erp-primary ring-2 ring-erp-primary/30' : 'border-black/10',
              )}
              style={{ backgroundColor: hex }}
              onClick={() => applyColor(hex)}
            />
          )
        })}
      </div>
    </div>
  )
}
