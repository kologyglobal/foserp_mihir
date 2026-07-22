import * as api from '@/services/api/treasuryApi'
import type { BookQuery, BookResultDto } from './treasury-books.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchBankbook(query: BookQuery): Promise<BookResultDto> {
  return unwrap(await api.getBankbook(query))
}

export async function fetchCashbook(query: BookQuery): Promise<BookResultDto> {
  return unwrap(await api.getCashbook(query))
}

export async function downloadBankbookCsv(query: BookQuery) {
  return api.downloadBankbookCsv(query)
}

export async function downloadCashbookCsv(query: BookQuery) {
  return api.downloadCashbookCsv(query)
}
