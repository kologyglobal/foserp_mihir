import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import {
  createKnowledgeChatSession,
  fetchChatSuggestions,
  fetchKnowledgeStatus,
  streamChatMessage,
  type KnowledgeCitation,
} from '@/services/api/knowledgeApi'
import { canKbPermission } from '@/utils/permissions/knowledge'
import { useUIStore } from '@/store/uiStore'
import { PageBackLink } from '@/components/ui/PageBackLink'

type Turn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: KnowledgeCitation[]
  streaming?: boolean
}

export function KnowledgeHomePage() {
  const openCopilot = useUIStore((s) => s.openCopilot)
  const [status, setStatus] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const canChat = canKbPermission('kb.chat.use')

  useEffect(() => {
    if (!isApiMode()) {
      setStatus('Demo mode — enable VITE_USE_API=true for live knowledge chat.')
      return
    }
    void (async () => {
      try {
        const st = await fetchKnowledgeStatus()
        const wave = st.data?.wave ?? '?'
        setStatus(`Wave ${wave} · chat ${st.data?.chatMode ?? '-'} · copilot ${st.data?.copilotMode ?? '-'}`)
        if (canChat) {
          const session = await createKnowledgeChatSession({ title: 'Knowledge workspace' })
          setSessionId(session.data.id)
          const sug = await fetchChatSuggestions()
          setSuggestions(sug.data?.items ?? [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [canChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy || !sessionId) return
    setError(null)
    setInput('')
    const assistantId = `a-${Date.now()}`
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])
    setBusy(true)
    try {
      await streamChatMessage(sessionId, content, {
        onMeta: (meta) => {
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
          const final = typeof data.content === 'string' ? data.content : undefined
          const citations = data.citations as KnowledgeCitation[] | undefined
          setTurns((prev) =>
            prev.map((t) =>
              t.id === assistantId
                ? {
                    ...t,
                    content: final && final.length >= t.content.length ? final : t.content,
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
                ? { ...t, content: t.content || message, streaming: false }
                : t,
            ),
          )
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="erp-page erp-page--enterprise mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <PageBackLink to="/home" label="Home" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-erp-text">Knowledge</h1>
          <p className="mt-1 text-sm text-erp-muted">
            Chat with indexed documents. Use global Copilot for screen-aware Q&amp;A.
          </p>
          {status && <p className="mt-1 text-xs text-erp-muted">{status}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-erp-border bg-white px-3 py-1.5 text-sm font-medium text-erp-text hover:bg-slate-50"
            onClick={openCopilot}
          >
            <Sparkles className="h-4 w-4 text-sky-700" />
            Open Copilot
          </button>
          <Link
            to="/knowledge/documents"
            className="inline-flex items-center rounded-md border border-erp-border bg-white px-3 py-1.5 text-sm font-medium text-erp-text hover:bg-slate-50"
          >
            Documents
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {suggestions.length > 0 && turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-erp-border bg-white px-3 py-1 text-xs text-erp-text hover:bg-slate-50"
              onClick={() => void send(s)}
              disabled={busy || !sessionId}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[280px] rounded-lg border border-erp-border bg-white p-4">
        {turns.length === 0 && (
          <p className="text-sm text-erp-muted">
            {canChat
              ? 'Ask a question about your knowledge base.'
              : 'You need kb.chat.use to chat here.'}
          </p>
        )}
        <div className="space-y-3">
          {turns.map((t) => (
            <div key={t.id} className={t.role === 'user' ? 'text-right' : ''}>
              <div
                className={
                  t.role === 'user'
                    ? 'inline-block rounded-lg bg-sky-50 px-3 py-2 text-left text-sm text-erp-text'
                    : 'text-left text-sm text-erp-text whitespace-pre-wrap'
                }
              >
                {t.content}
                {t.streaming && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
              </div>
              {t.citations && t.citations.length > 0 && (
                <ul className="mt-1 text-left text-xs text-erp-muted">
                  {t.citations.map((c) => (
                    <li key={c.chunkId}>
                      [{c.index}] {c.documentTitle}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          className="min-h-[44px] flex-1 rounded-md border border-erp-border px-3 py-2 text-sm"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the knowledge base…"
          disabled={!canChat || busy || !sessionId}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 self-end rounded-md bg-sky-800 px-3 py-2 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-50"
          onClick={() => void send(input)}
          disabled={!canChat || busy || !sessionId || !input.trim()}
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  )
}
