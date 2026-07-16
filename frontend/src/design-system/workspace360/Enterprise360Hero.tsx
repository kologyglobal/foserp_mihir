import { Mail, MapPin, Phone, Star } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface Enterprise360HeroProps {
  recordNo: string
  title: string
  subtitle?: string
  location?: string
  customerRating?: number
  customerRatingLabel?: string
  status: string
  statusTone?: 'success' | 'warning' | 'critical' | 'info' | 'neutral'
  stage?: string
  probability?: string | number
  owner?: string
  created?: string
  lastActivity?: string
  phone?: string
  email?: string
  source?: string
  industry?: string
  badges?: { label: string; tone?: string }[]
}

const toneClass = {
  success: 'ent-360-hero__chip--success',
  warning: 'ent-360-hero__chip--warning',
  critical: 'ent-360-hero__chip--critical',
  info: 'ent-360-hero__chip--info',
  neutral: 'ent-360-hero__chip--neutral',
}

function StarRating({ rating, label }: { rating: number; label?: string }) {
  const stars = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <span className="ent-360-hero__stars" title={label}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i < stars ? 'fill-amber-400 text-amber-400' : 'text-erp-border')} />
      ))}
      {label ? <span className="ml-1.5 text-[12px] font-semibold text-erp-muted">{label}</span> : null}
    </span>
  )
}

export function Enterprise360Hero({
  recordNo,
  title,
  subtitle,
  location,
  customerRating,
  customerRatingLabel,
  status,
  statusTone = 'info',
  stage,
  probability,
  owner,
  created,
  lastActivity,
  phone,
  email,
  source,
  industry,
  badges = [],
}: Enterprise360HeroProps) {
  return (
    <section className="ent-360-hero" aria-label="Record summary">
      <div className="ent-360-hero__glow" aria-hidden />
      <div className="ent-360-hero__inner">
        <div className="ent-360-hero__identity">
          <p className="ent-360-hero__record-no">{recordNo}</p>
          <h1 className="ent-360-hero__title">{title}</h1>
          {subtitle ? <p className="ent-360-hero__subtitle">{subtitle}</p> : null}
          {location ? (
            <p className="ent-360-hero__location">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          ) : null}
          {customerRating != null ? (
            <StarRating rating={customerRating} label={customerRatingLabel} />
          ) : null}
        </div>

        <div className="ent-360-hero__metrics">
          <div className="ent-360-hero__chip-row">
            <span className={cn('ent-360-hero__chip', toneClass[statusTone])}>Status: {status}</span>
            {stage ? <span className="ent-360-hero__chip ent-360-hero__chip--neutral">Stage: {stage}</span> : null}
            {probability != null ? (
              <span className="ent-360-hero__chip ent-360-hero__chip--info">Probability: {probability}%</span>
            ) : null}
            {badges.map((b) => (
              <span key={b.label} className="ent-360-hero__chip ent-360-hero__chip--neutral">{b.label}</span>
            ))}
          </div>
          <div className="ent-360-hero__meta-grid">
            {owner ? <span><strong>Owner</strong> {owner}</span> : null}
            {created ? <span><strong>Created</strong> {created}</span> : null}
            {lastActivity ? <span><strong>Last Activity</strong> {lastActivity}</span> : null}
            {phone ? (
              <a href={`tel:${phone}`} className="ent-360-hero__contact-link">
                <Phone className="h-3.5 w-3.5" />{phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="ent-360-hero__contact-link">
                <Mail className="h-3.5 w-3.5" />{email}
              </a>
            ) : null}
            {source ? <span><strong>Source</strong> {source}</span> : null}
            {industry ? <span><strong>Industry</strong> {industry}</span> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
