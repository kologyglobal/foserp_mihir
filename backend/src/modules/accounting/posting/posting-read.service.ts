import * as glRepo from '../ledger/general-ledger.repository.js'
import * as lineRepo from '../ledger/accounting-voucher-line.repository.js'
import * as voucherRepo from '../ledger/accounting-voucher.repository.js'
import * as postingEventRepo from '../ledger/posting-event.repository.js'

export async function getPostingEvent(tenantId: string, id: string) {
  return postingEventRepo.findByIdOrThrow(tenantId, id)
}

export async function getVoucher(tenantId: string, id: string) {
  const voucher = await voucherRepo.findByIdOrThrow(tenantId, id)
  const lines = await lineRepo.findByVoucherId(tenantId, id)
  return { ...voucher, lines }
}

export async function getVoucherLedger(tenantId: string, id: string) {
  await voucherRepo.findByIdOrThrow(tenantId, id)
  const entries = await glRepo.findByVoucherId(tenantId, id)
  return entries
}
