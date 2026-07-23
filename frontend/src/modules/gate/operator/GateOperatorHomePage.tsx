/**
 * Gatekeeper Mode home — six large operational actions only.
 * No reports, settings, masters, configuration or complex tables.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LogIn,
  LogOut,
  Truck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { gateService } from '../api/gateService'
import type { GateDashboardSummary } from '../types/gate.types'
import { CallSupervisorButton } from './GateOperatorKit'
import { cn } from '@/utils/cn'

interface ActionTile {
  to: string
  label: string
  helper: string
  icon: LucideIcon
  accent: string
  count?: number | null
  countLabel?: string
}

export function GateOperatorHomePage() {
  const [summary, setSummary] = useState<GateDashboardSummary | null>(null)

  useEffect(() => {
    let active = true
    gateService
      .getGateDashboard()
      .then((s) => {
        if (active) setSummary(s)
      })
      .catch(() => {
        /* counts are optional decoration — tiles still work */
      })
    return () => {
      active = false
    }
  }, [])

  const tiles: ActionTile[] = [
    {
      to: 'visitor-entry',
      label: 'Visitor Entry',
      helper: 'Let a visitor in',
      icon: UserPlus,
      accent: 'bg-blue-600',
      count: summary?.expectedVisitorsToday ?? null,
      countLabel: 'expected today',
    },
    {
      to: 'visitor-exit',
      label: 'Visitor Exit',
      helper: 'Visitor is leaving',
      icon: LogOut,
      accent: 'bg-indigo-600',
      count: summary?.visitorsInside ?? null,
      countLabel: 'inside now',
    },
    {
      to: 'vehicle-entry',
      label: 'Vehicle Entry',
      helper: 'Let a vehicle in',
      icon: Truck,
      accent: 'bg-emerald-600',
    },
    {
      to: 'vehicle-exit',
      label: 'Vehicle Exit',
      helper: 'Vehicle is leaving',
      icon: LogIn,
      accent: 'bg-teal-600',
      count: summary?.vehiclesInside ?? null,
      countLabel: 'inside now',
    },
    {
      to: 'material-inward',
      label: 'Material Inward',
      helper: 'Material has arrived',
      icon: ArrowDownToLine,
      accent: 'bg-amber-600',
    },
    {
      to: 'material-outward',
      label: 'Material Outward',
      helper: 'Check and release material',
      icon: ArrowUpFromLine,
      accent: 'bg-rose-600',
      count: summary?.outwardAwaitingRelease ?? null,
      countLabel: 'waiting release',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">What do you want to do?</h1>
      <p className="mt-1 text-base text-slate-600">Tap one action. Follow the steps on screen.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="flex min-h-[150px] flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 active:scale-[0.98]"
          >
            <span
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl text-white',
                tile.accent,
              )}
            >
              <tile.icon className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight text-slate-900">
                {tile.label}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">{tile.helper}</span>
              {typeof tile.count === 'number' && tile.count > 0 && (
                <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  {tile.count} {tile.countLabel}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <CallSupervisorButton />
        <p className="mt-2 text-center text-sm text-slate-500">
          Not sure what to do? Call the supervisor. Do not guess.
        </p>
      </div>
    </div>
  )
}
