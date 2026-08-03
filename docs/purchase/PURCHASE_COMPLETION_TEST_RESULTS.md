# Purchase Completion — Test Results

Date: **2026-07-28**

## New / focused

| Test | Result |
|------|--------|
| `purchase-completion-grn-costing.test.ts` | PASS (GRN → InventoryCostEntry) |

## Existing purchase suites (prior evidence)

QI / Invoice / Return / GRN lifecycle tests remain the regression base.

## FE changes verified by review

- Invoice post toast no longer claims “AP/GL deferred demo-only” in API mode
- Money Out deep link + AP handoff panel
- GRN Receiving chain + Create Invoice / Cost Entries
- Return ACCOUNTING_ADJUSTMENT_PENDING banner
- Cost entries page honors `?search=`

## Verdict

**READY FOR INTERNAL UAT** for Purchase → stock value → payable **draft** handoff.

Conditions: live SPA sign-off; return AP credit deferred; invoice cost adjustment deferred; QI parameters thin in API.
