import { useMemo } from 'react'
import { ArrowLeftRight, BookOpen, Receipt, RotateCcw, Scale } from 'lucide-react'
import { EnterpriseKpiStrip } from '@/design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LedgerSummary } from '@/types/ledgerEntries'
import { formatCompactCurrency, formatNumber } from '@/utils/formatters/currency'

export function LedgerSummaryStrip({
  summary,
  showReversedEntries = true,
  activeId,
  onKpiClick,
}: {
  summary: LedgerSummary
  showReversedEntries?: boolean
  activeId?: string | null
  onKpiClick?: (id: string) => void
}) {
  const items: EnterpriseKpiItem[] = useMemo(() => {
    const click = (id: string) => (onKpiClick ? () => onKpiClick(id) : undefined)
    const base: EnterpriseKpiItem[] = [
      {
        id: 'entryCount',
        label: 'Entries',
        value: formatNumber(summary.entryCount),
        icon: BookOpen,
        accent: 'blue',
        active: activeId === 'entryCount',
        onClick: click('entryCount'),
      },
      {
        id: 'totalDebit',
        label: 'Total debit',
        value: formatCompactCurrency(summary.totalDebit),
        icon: Receipt,
        accent: 'green',
        active: activeId === 'totalDebit',
        onClick: click('totalDebit'),
      },
      {
        id: 'totalCredit',
        label: 'Total credit',
        value: formatCompactCurrency(summary.totalCredit),
        icon: Receipt,
        accent: 'slate',
        active: activeId === 'totalCredit',
        onClick: click('totalCredit'),
      },
      {
        id: 'netMovement',
        label: 'Net movement',
        value: formatCompactCurrency(summary.netMovement),
        icon: ArrowLeftRight,
        accent: 'amber',
        active: activeId === 'netMovement',
        onClick: click('netMovement'),
      },
      {
        id: 'postedVouchers',
        label: 'Posted vouchers',
        value: formatNumber(summary.postedVouchers),
        icon: Scale,
        accent: 'blue',
        active: activeId === 'postedVouchers',
        onClick: click('postedVouchers'),
      },
    ]
    if (showReversedEntries) {
      base.push({
        id: 'reversedEntries',
        label: 'Reversed entries',
        value: formatNumber(summary.reversedEntries),
        icon: RotateCcw,
        accent: 'red',
        active: activeId === 'reversedEntries',
        onClick: click('reversedEntries'),
      })
    }
    return base
  }, [summary, showReversedEntries, activeId, onKpiClick])

  return <EnterpriseKpiStrip items={items} columns={showReversedEntries ? 6 : 5} />
}
