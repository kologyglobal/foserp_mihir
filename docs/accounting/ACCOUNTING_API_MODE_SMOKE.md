# Accounting API-Mode Smoke

## Configuration

- `VITE_USE_API=true`
- `VITE_API_BASE_URL=http://127.0.0.1:5000/api/v1`
- `VITE_TENANT_SLUG=vasant-trailers`

## Money In (`npm run test:money-in`)

**Result: 76/76 pass** (2026-07-18)

Includes demo-store/API-bridge checks for:

- Invoice / receipt / credit-note workspaces
- Allocate + reverse allocation demos
- Reverse document demos (receipt + credit note)

## Journals

- UI: `JournalDetailPage` Reverse modal + REVERSED banner wired to `reverseJournal` bridge
- Live BE: `finance-journal-reversal.test.ts` **5/5**
- Full multi-role browser path (Executive submit → Approver → Poster → Reverse) **not browser-automated this gate**

## Routes registered (refresh-safe SPA)

From `frontend/src/routes/accountingRoutes.tsx`:

- `/accounting/money-in` (+ invoices, receipts, credit-notes, outstanding, customers, ageing, reconciliation)
- `/accounting/entries/journals` (+ detail/edit)
- `/accounting/entries/approvals`

API routes under `/api/v1/t/:tenantSlug/accounting/*` return JSON (health + live finance tests).

## Error / permission surfaces

- Reverse 403 covered in 2C3/3D tests
- Alloc-before-doc reverse 422 covered in 3D tests
- Stale / concurrent post conflicts covered in posting suites
