import { Children, isValidElement, type ReactNode } from 'react'

export interface ParsedSelectOption {
  value: string
  label: string
  disabled?: boolean
}

function optionLabel(children: ReactNode, value?: string): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map((c) => optionLabel(c)).join('')
  return value ?? ''
}

/** Flatten `<option>` children from a native `<select>` into searchable options. */
export function parseSelectOptions(children: ReactNode): ParsedSelectOption[] {
  const out: ParsedSelectOption[] = []

  function walk(nodes: ReactNode) {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return
      if (child.type === 'option') {
        const props = child.props as { value?: string; children?: ReactNode; disabled?: boolean }
        out.push({
          value: props.value ?? '',
          label: optionLabel(props.children, props.value),
          disabled: props.disabled,
        })
        return
      }
      const nested = (child.props as { children?: ReactNode }).children
      if (nested) walk(nested)
    })
  }

  walk(children)
  return out
}

export function toSmartSelectOptions(parsed: ParsedSelectOption[]) {
  return parsed
    .filter((o) => !o.disabled)
    .map((o) => ({
      value: o.value,
      label: o.label,
      searchText: `${o.label} ${o.value}`.toLowerCase(),
    }))
}
