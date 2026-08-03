# Maintenance V1.1 — UAT Checklist

## Repeat breakdown
- [ ] 3 tickets on same machine within 30 days → `repeatBreakdown=true`, health ATTENTION

## Production breakdown
- [ ] Report from My Work / WO with machine → ticket has WO/JC/op; machine OUT_OF_SERVICE; MFG banner shows ticket

## Downtime / repair
- [ ] Open ticket downtime increases; after TEST PASS + Close, downtime and repair minutes set; no manual duration fields

## Spare issue
- [ ] Stockable part → ISSUE_TO_MAINTENANCE + cost entry; ticket partsCost matches once

## Shortage → PR
- [ ] Create PR from shortage link → `sourceType=MAINTENANCE`, `sourceId=ticketId`; part shows Open PR; ticket WAITING_FOR_PART

## Contractor
- [ ] External job with service + parts; contractor report includes job

## Failed test
- [ ] TEST FAIL blocks close; machine stays UNDER_MAINTENANCE; PASS then close

## Machine Health
- [ ] Rankings by downtime / breakdowns / cost match tickets; no fake metrics
