import { Activity } from 'lucide-react'

/** Operational summary generated from current gate data — no AI service involved. */
export function GatePulseCard({ messages }: { messages: string[] }) {
  return (
    <section className="rounded-md border border-erp-border bg-white">
      <header className="flex items-center gap-2 border-b border-erp-border px-4 py-2.5">
        <Activity className="h-4 w-4 text-erp-primary" aria-hidden />
        <h3 className="text-[13px] font-semibold text-erp-text">Gate Pulse</h3>
      </header>
      <div className="px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-[13px] text-erp-muted">All quiet at the gate — no pending actions right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {messages.map((message, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-erp-text">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-erp-primary" aria-hidden />
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
