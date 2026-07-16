# Maximum Update Depth Root Cause Report

## Primary Root Cause

**Zustand selectors returning new object/array references on every invocation.**

React re-renders when Zustand selector output changes (`Object.is` comparison). Patterns like:

```tsx
// BAD — new array every render → infinite loop
const receivables = useInvoiceStore((s) => s.getReceivables())
```

trigger: render → selector → new array → store notify → render → … until React throws **Maximum update depth exceeded**.

## Confirmed Incident: CRM Customers (`/crm/customers`)

| Field | Detail |
|-------|--------|
| Route | `/crm/customers` |
| Component | `CrmCustomersPage` in `CrmEntityPages.tsx` |
| Hook | `useInvoiceStore((s) => s.getReceivables())` |
| Store action | `invoiceStore.getReceivables()` builds new array via `.filter().map().sort()` |
| Fix | `useReceivables()` in `useStableStoreData.ts` — subscribe to `invoices` slice, memoize getter |

## Secondary Causes Fixed

| Route / Area | Component | Issue | Fix |
|--------------|-----------|-------|-----|
| Customer 360 | `Customer360Page` | `getContactsForCustomer()` in selector | `useCustomerContacts()` |
| Sales quotation | `SalesPages` | `getCommercialTermsByType()` in selector | `useCommercialTermsByType()` |
| Quick Create drawer | `QuickCreateDrawerForm` | `.filter()` / getters in selectors | `useMasterLists` hooks |
| DMS approvals | `DocumentApprovalQueuePage` | `getApprovalQueue()` in selector | `useDmsApprovalQueue()` |
| Barcode history | `BarcodeHistoryPage` | `getAllHistory()` in selector | `useBarcodeHistory()` |
| QR toolbar | `EntityQrToolbar` | `getForEntity()[0]` in selector | memoize on `records` slice |
| UI chrome | `uiStore` | `trackPageVisit` / `closeMobileNav` unnecessary updates | path guard + conditional set |
| CRM hydration | `crmHydration.ts` | repeated store writes on mount | `crmDataHydrationDone` flag |

## Scan Results

- Files scanned: 573
- Violations remaining: 0

No anti-patterns detected in application code.

Generated: 2026-06-29T10:28:35.074Z
