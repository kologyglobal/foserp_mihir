import { useCallback, useEffect, useState } from 'react'
import * as treasuryApi from '@/services/api/treasuryApi'
import { notify } from '@/store/toastStore'
import type { TransferAccountSnapshot } from '../api/treasury-transfer.types'

/** BANK/CASH treasury accounts only (CLEARING accounts are never transfer endpoints). */
export function useTreasuryAccountOptions(legalEntityId: string | undefined) {
  const [accounts, setAccounts] = useState<TransferAccountSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!legalEntityId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await treasuryApi.listTreasuryAccounts({ legalEntityId, status: 'ACTIVE', limit: 200 })
      const mapped = res.items
        .filter((a) => a.accountType === 'BANK' || a.accountType === 'CASH')
        .map((a): TransferAccountSnapshot => {
          const raw = a as unknown as {
            maskedNumber?: string | null
            bookBalance?: string | null
            bankProfile?: { bankName?: string; accountNumberMasked?: string } | null
          }
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            accountType: a.accountType as 'BANK' | 'CASH',
            currencyCode: a.currencyCode,
            maskedNumber: raw.maskedNumber ?? raw.bankProfile?.accountNumberMasked ?? null,
            bankName: a.bankProfile?.bankName ?? null,
            bookBalance: raw.bookBalance ?? null,
          }
        })
      setAccounts(mapped)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load treasury accounts')
    } finally {
      setLoading(false)
    }
  }, [legalEntityId])

  useEffect(() => {
    void load()
  }, [load])

  return { accounts, loading, reload: load }
}
