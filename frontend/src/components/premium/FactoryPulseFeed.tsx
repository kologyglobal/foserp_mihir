import { useLiveFactoryPulse } from '../../hooks/useLiveFactoryPulse'
import { FactoryPulseItem } from './FactoryPulseItem'
import { Link } from 'react-router-dom'
import { ArrowRight, Radio } from 'lucide-react'

export function FactoryPulseFeed({ minEvents = 10 }: { minEvents?: number }) {
  const { events, lastUpdated } = useLiveFactoryPulse(minEvents)
  const time = new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <section className="erp-saas-panel">
      <div className="erp-saas-panel-header">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-erp-accent" />
          <h3 className="erp-saas-panel-title">Factory pulse</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="erp-type-micro">Updated {time}</span>
          <Link to="/executive" className="erp-saas-link">
            Full view <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="erp-factory-pulse-list max-h-80 overflow-y-auto px-1 py-2">
        {events.map((e) => (
          <FactoryPulseItem
            key={e.id}
            label={e.action}
            detail={e.documentRef}
            time={e.timestamp?.slice(11, 16)}
            tone="live"
            href={e.href}
          />
        ))}
      </div>
    </section>
  )
}
