# Kology UAT

## Golden path A — O2C

1. Lead: ABC Technology → Qualify  
2. Opportunity: Outbound Sales Consulting ₹300,000  
3. Quotation ₹300,000 — terms 50% advance / 50% Net 30 → Approve  
4. Convert → SO ₹300,000  
5. Proforma ₹150,000 → Receipt ₹150,000 advance → Allocate  
6. Sales Invoice ₹300,000 → Allocate advance ₹150,000 → Outstanding ₹150,000  
7. Final receipt ₹150,000 → Outstanding ₹0  

Verify: CRM status, SO, AR, Money In, Bank, GL, Customer 360.

## Golden path B — Expense

Software subscription ₹20,000 → Vendor Bill/Expense → Pay from Bank → Expense GL + P&L.

## Credentials (API mode)
- `tenantSlug=kology` · `admin@kology.co` / `Admin@123`
- Sales: `sales@kology.co` / `Sales@123`
- Accounts: `accounts@kology.co` / `Accounts@123`

## Packaging evidence (2026-07-27)

| Check | Result |
|-------|--------|
| Migration `businessType` | Applied |
| Seed `kology` + 12 services | Applied via `seedKologyOnly.ts` |
| Module flags SERVICES pack | Applied in seed |
| Over-invoice guard | Code shipped |
| Nav/route gates | Code shipped |

## Golden paths (manual UAT — record when run)

See original scenarios in this file (O2C ₹300k + expense ₹20k). Mark PASS/FAIL with date and operator after live API run on `kology`.

