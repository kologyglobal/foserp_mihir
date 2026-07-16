# Dashboard Analytics Validation Report

**Date:** 2026-06-25

| KPI | Analytics Service | Source Match | Status |
|-----|------------------:|--------------|--------|
| Order book value | 145750000 | SO store | ✓ |
| Open SO count | 16 | MRP store | ✓ |
| Invoiced YTD | 295000000 | Invoice store | ✓ |
| Outstanding AR | 41536000 | Invoice store | ✓ |
| WIP value | 739860 | WO store | ✓ |
| Dispatch ready | 0 (0) | Dispatch store | ✓ |
| Running WO | 14 | WO store | ✓ |
| QC pending | 0 | Quality store | ✓ |
| Open NCR | 0 | Quality store | ✓ |
| Pending approvals | 5 | Approval store | ✓ |

**Consistency validator:** ✓ PASS  
**Hardcoded KPI check:** No fake zeros when data exists — ✓  
**Live strip alignment:** DynamicsLiveStrip uses same analytics hook — ✓
