import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})

storage.set(
  'fos-erp-auth',
  JSON.stringify({
    accessToken: 'approval-test-token',
    refreshToken: '',
    tenantId: 'tenant-test',
    tenantSlug: 'approval-test',
    accessTokenExpiresAt: Date.now() + 60_000,
    user: {
      id: 'approver-1',
      firstName: 'Approval',
      lastName: 'Tester',
      email: 'approval@test.local',
      roles: ['Purchase Manager'],
      permissions: ['purchase.pr.approve', 'purchase.po.approve'],
    },
  }),
)

const calls: Array<{ url: string; method: string; body?: unknown }> = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  calls.push({
    url,
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  })
  const data = url.endsWith('/delegate')
    ? {
        approvalId: 'approval-1',
        delegatedTo: {
          id: 'approver-2',
          name: 'Second Approver',
          email: 'second@test.local',
          role: 'Purchase Manager',
        },
      }
    : []
  return new Response(JSON.stringify({ success: true, message: 'ok', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}) as typeof fetch

const approvalApi = await import('../src/services/purchase/purchaseApprovalApi')

await approvalApi.listPurchaseApprovalsApi({
  tab: 'pending_mine',
  documentType: 'PURCHASE_ORDER',
  page: 1,
  limit: 100,
})
assert.match(
  calls[0].url,
  /\/api\/v1\/t\/approval-test\/purchase\/approvals\?.*tab=pending_mine/,
)
assert.match(calls[0].url, /documentType=PURCHASE_ORDER/)

await approvalApi.delegatePurchaseApprovalApi('approval-1', {
  toUserId: 'approver-2',
  remarks: 'Please review',
})
assert.equal(calls[1].method, 'POST')
assert.match(calls[1].url, /\/purchase\/approvals\/approval-1\/delegate$/)
assert.deepEqual(calls[1].body, {
  toUserId: 'approver-2',
  remarks: 'Please review',
})

const facade = await readFile(
  resolve('src/services/purchase/purchaseApiFacade.ts'),
  'utf8',
)
assert.match(facade, /listPurchaseApprovalsApi/)
assert.match(facade, /delegatePurchaseApprovalApi/)
assert.doesNotMatch(facade, /Approval delegation is not available in API mode yet/)
assert.doesNotMatch(facade, /canAct:\s*canAct\s*\|\|/)

const page = await readFile(resolve('src/modules/purchase/PurchaseApprovalsPage.tsx'), 'utf8')
assert.doesNotMatch(page, /finance_head/)

console.log('Purchase approvals frontend API contract: PASS (9 assertions)')
