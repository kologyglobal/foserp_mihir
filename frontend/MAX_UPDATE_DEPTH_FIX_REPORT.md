# Maximum Update Depth Fix Report

## Verdict

**Fixes applied — remaining violations need review**

## Tests

- Passed: 20
- Failed: 1
- Routes validated: 12

## Files Changed

- `src/hooks/useStableStoreData.ts` — added `useReceivables`, `useCustomerContacts`, `useCommercialTermsByType`, `useDmsApprovalQueue`, `useBarcodeHistory`, `useOpenOpportunities`, `useApprovalRequestCount`
- `src/hooks/useMasterLists.ts` — added `useActiveUoms`, `useActiveVendors`
- `src/utils/safeState.ts` — `shouldNavigate`, `isSameValue`
- `src/modules/crm/CrmEntityPages.tsx` — fixed receivables selector
- `src/modules/entity360/Customer360Page.tsx` — fixed contacts selector
- `src/modules/sales/SalesPages.tsx` — fixed commercial terms selector
- `src/components/quick-create/QuickCreateDrawerForm.tsx` — stable list hooks
- `src/components/approval/ApprovalChainPanel.tsx` — stable approval count
- `src/modules/dms/DmsPages.tsx`, `BarcodePages.tsx`, `EntityQrToolbar.tsx`
- `src/store/uiStore.ts` — guarded page tracking and mobile nav close
- `src/utils/crmHydration.ts` — one-time hydration guard
- `src/modules/crm/CrmDashboardPage.tsx` — removed duplicate hydration effect
- `src/components/layout/DynamicsWorkspaceChrome.tsx` — guarded tab navigation
- `src/components/system/AppErrorBoundary.tsx` — enhanced debug panel

## Routes Tested

- /crm
- /crm/leads
- /crm/customers
- /crm/contacts
- /crm/opportunities
- /crm/opportunities/kanban
- /crm/opportunities
- /crm/quotations
- /planning/mrp
- /dashboard
- /sales
- /uat/dashboard

## Remaining Risk Areas

- Mobile ops pages with inline `.filter()` selectors (lower traffic)
- Any new page using `useStore((s) => s.getSomething())` without `useStableStoreData`
- Run `npm run test:max-update-depth` in CI to catch regressions

Generated: 2026-06-29T10:28:35.075Z
