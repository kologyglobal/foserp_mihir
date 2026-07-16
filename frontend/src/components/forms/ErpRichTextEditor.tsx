import { useCallback, useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Table2,
  Underline,
} from 'lucide-react'
import { cn } from '../../utils/cn'

interface ErpRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="erp-richtext-editor__btn"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function ErpRichTextEditor({
  value,
  onChange,
  placeholder = 'Enter formatted content…',
  className,
  minHeight = 200,
}: ErpRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  const syncFromDom = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ''
    const empty = !editorRef.current?.textContent?.trim()
    onChange(empty ? '' : html)
  }, [onChange])

  useEffect(() => {
    const el = editorRef.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [value])

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, arg)
    syncFromDom()
  }

  const insertTable = () => {
    editorRef.current?.focus()
    const table = `
      <table class="erp-richtext-table">
        <thead><tr><th>Item</th><th>Details</th></tr></thead>
        <tbody>
          <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
      <p><br></p>
    `
    document.execCommand('insertHTML', false, table)
    syncFromDom()
  }

  return (
    <div className={cn('erp-richtext-editor', className)}>
      <div className="erp-richtext-editor__toolbar" role="toolbar" aria-label="Formatting">
        <ToolbarButton label="Bold" onClick={() => exec('bold')}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec('italic')}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => exec('underline')}><Underline className="h-4 w-4" /></ToolbarButton>
        <span className="erp-richtext-editor__divider" aria-hidden />
        <ToolbarButton label="Bullet list" onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <span className="erp-richtext-editor__divider" aria-hidden />
        <ToolbarButton label="Insert table" onClick={insertTable}><Table2 className="h-4 w-4" /></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        className="erp-richtext-editor__surface"
        style={{ minHeight }}
        contentEditable
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        onInput={syncFromDom}
        onBlur={syncFromDom}
        suppressContentEditableWarning
      />
    </div>
  )
}

export function ErpRichTextRead({ html, className }: { html: string; className?: string }) {
  if (!html?.trim()) return <span>—</span>
  return (
    <div
      className={cn('erp-richtext-read', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
