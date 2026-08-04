import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Loader2, Send, Sparkles, Square, X } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import {
  type KnowledgeCitation,
  stopCopilotStream,
  streamCopilotComplete,
} from '@/services/api/knowledgeApi'
import { useUIStore } from '@/store/uiStore'
import { canUseCopilot } from '@/utils/permissions/knowledge'
import { buildCopilotContextFromLocation } from '@/utils/knowledge/erpRouteContext'
import { cn } from '@/utils/cn'

type ChatTurn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: KnowledgeCitation[]
  streaming?: boolean
}

export function KnowledgeCopilotPanel() {
  const open = useUIStore((s) => s.copilotOpen)
  const close = useUIStore((s) => s.closeCopilot)
  const location = useLocation()
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamId, setStreamId] = useState<string | null>(null)
  const [contextLabel, setContextLabel] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const allowed = canUseCopilot()

  useEffect(() => {
    if (!open) return
    const ctx = buildCopilotContextFromLocation(location.pathname)
    const bits = [ctx.moduleKey, ctx.entityType, ctx.routePath].filter(Boolean)
    setContextLabel(bits.join(' · '))
  }, [open, location.pathname])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, open])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  if (!open) return null

  async function handleStop() {
    const id = streamId
    abortRef.current?.abort()
    if (id && isApiMode()) {
      try {
        await stopCopilotStream(id)
      } catch {
        // ignore
      }
    }
    setBusy(false)
    setStreamId(null)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    if (!isApiMode()) {
      setError('Copilot requires API mode (VITE_USE_API=true).')
      return
    }
    if (!allowed) {
      setError('You need kb.copilot.use permission.')
      return
    }

    setError(null)
    setInput('')
    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', content: text }
    const assistantId = `a-${Date.now()}`
    setTurns((prev) => [
      ...prev,
      userTurn,
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])
    setBusy(true)

    const history = turns
      .filter((t) => t.content.trim())
      .map((t) => ({ role: t.role, content: t.content }))

    const context = buildCopilotContextFromLocation(location.pathname)
    const abort = new AbortController()
    abortRef.current = abort

    try {
      await streamCopilotComplete(
        { content: text, context, history },
        {
          signal: abort.signal,
          onMeta: (meta) => {
            if (typeof meta.streamId === 'string') setStreamId(meta.streamId)
            const citations = meta.citations as KnowledgeCitation[] | undefined
            if (citations?.length) {
              setTurns((prev) =>
                prev.map((t) => (t.id === assistantId ? { ...t, citations } : t)),
              )
            }
          },
          onToken: (token) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId ? { ...t, content: t.content + token } : t,
              ),
            )
          },
          onDone: (data) => {
            const content = typeof data.content === 'string' ? data.content : undefined
            const citations = data.citations as KnowledgeCitation[] | undefined
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId
                  ? {
                      ...t,
                      content: content && content.length >= t.content.length ? content : t.content,
                      citations: citations ?? t.citations,
                      streaming: false,
                    }
                  : t,
              ),
            )
          },
          onError: (message) => {
            setError(message)
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId
                  ? { ...t, content: t.content || `Error: ${message}`, streaming: false }
                  : t,
              ),
            )
          },
        },
      )
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setTurns((prev) =>
          prev.map((t) => (t.id === assistantId ? { ...t, streaming: false } : t)),
        )
      } else {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? { ...t, content: t.content || `Error: ${message}`, streaming: false }
              : t,
          ),
        )
      }
    } finally {
      setBusy(false)
      setStreamId(null)
      abortRef.current = null
    }
  }

  return (
    <>
      <div className="kb-copilot-backdrop" onClick={close} aria-hidden />
      <aside className="kb-copilot-panel" role="dialog" aria-label="ERP Copilot">
        <header className="kb-copilot-panel__header">
          <div className="kb-copilot-panel__title-row">
            <Sparkles className="h-4 w-4 text-sky-700" aria-hidden />
            <div>
              <h2 className="kb-copilot-panel__title">Copilot</h2>
              <p className="kb-copilot-panel__subtitle" title={contextLabel}>
                {contextLabel || 'Current screen'}
              </p>
            </div>
          </div>
          <div className="kb-copilot-panel__header-actions">
            <Link
              to="/knowledge"
              className="kb-copilot-panel__link"
              onClick={close}
              title="Knowledge workspace"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
            <button type="button" className="kb-copilot-panel__icon-btn" onClick={close} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="kb-copilot-panel__body">
          {turns.length === 0 && (
            <div className="kb-copilot-panel__empty">
              <p>Ask about this screen or your knowledge base.</p>
              <p className="text-xs text-erp-muted">
                Answers use permitted record fields + indexed documents. Cite tags like [1].
              </p>
              {!isApiMode() && (
                <p className="mt-2 text-xs text-amber-800">
                  Copilot answers need API mode (`VITE_USE_API=true`). You can still open this panel in demo.
                </p>
              )}
              {isApiMode() && !allowed && (
                <p className="mt-2 text-xs text-amber-800">
                  Your role is missing <code>kb.copilot.use</code>. Ask an admin to grant it (or assign
                  Knowledge Manager / Tenant Admin), then re-login after{' '}
                  <code>npm run db:sync-permissions</code>.
                </p>
              )}
            </div>
          )}
          {turns.map((t) => (
            <div
              key={t.id}
              className={cn(
                'kb-copilot-msg',
                t.role === 'user' ? 'kb-copilot-msg--user' : 'kb-copilot-msg--assistant',
              )}
            >
              <div className="kb-copilot-msg__role">{t.role === 'user' ? 'You' : 'Copilot'}</div>
              <div className="kb-copilot-msg__content whitespace-pre-wrap">
                {t.content || (t.streaming ? '…' : '')}
                {t.streaming && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
              </div>
              {t.citations && t.citations.length > 0 && (
                <ul className="kb-copilot-citations">
                  {t.citations.map((c) => (
                    <li key={c.chunkId}>
                      [{c.index}] {c.documentTitle}
                      {c.headingPath ? ` — ${c.headingPath}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <div className="kb-copilot-panel__error">{error}</div>}

        <footer className="kb-copilot-panel__footer">
          <textarea
            className="kb-copilot-panel__input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={allowed ? 'Ask Copilot…' : 'Permission required: kb.copilot.use'}
            disabled={!allowed || busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          <div className="kb-copilot-panel__actions">
            {busy ? (
              <button type="button" className="kb-copilot-panel__send" onClick={() => void handleStop()}>
                <Square className="h-4 w-4" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="kb-copilot-panel__send"
                onClick={() => void handleSend()}
                disabled={!allowed || !input.trim()}
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  )
}
