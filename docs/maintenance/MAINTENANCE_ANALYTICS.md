# Maintenance Analytics (V1.1)

## Sources

- `MaintenanceTicket` — downtime, repair times, costs, failure categories, contractor
- `MaintenancePart` + `ISSUE_TO_MAINTENANCE` — spare valuation (inventory cost entry; no double count of estimates when movement exists)
- Machine Health read model — aggregates YTD / 30d / 90d

## Metrics

| Metric | Formula |
|--------|---------|
| Downtime | `closedAt/released − reportedAt` (open: now − reportedAt) |
| Repair time | `repairEndedAt (TEST PASS) − repairStartedAt` |
| MTTR | Σ repair durations ÷ completed repair tickets |
| Breakdown frequency | Ticket counts by machine / period |
| Maintenance cost | partsCost + serviceCost + otherCost on ticket |
| Production impact | Distinct WO/JC refs + downtime on tickets with production context |

## Reports (existing `/maintenance/reports`)

1. Machine Downtime  
2. Maintenance Cost  
3. Breakdown Frequency  
4. Contractor Performance (jobs, cost, avg repair minutes)  
5. Ticket list (extended with root cause / repair / production refs)

Machine History remains the per-machine drill-down.
