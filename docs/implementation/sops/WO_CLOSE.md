# SOP — Work Order Close

**Audience:** Supervisor  
**Route:** `/manufacturing/work-orders/:id` (API detail)

## Purpose

Close a WO when production quantity and quality gates for the pilot are satisfied.

## Preconditions

- Progress posted (My Work and/or Daily Update).  
- Materials issued as required by profile/consumption method.  
- Required QC complete for QC products.  
- FG receipt: only if pilot smoke of FG API passed; else physical FG book (MC-11).

## Steps

1. Review WO detail: qty good / reject / scrap, materials, QC status.  
2. Post FG receipt if in SOP and smoke-approved.  
3. Resolve open assignments / issues.  
4. Execute **Close** (or complete lifecycle action exposed by API).  
5. Record WO number + close time on daily recon.

## Do not

- Close with open mandatory QC.  
- Expect manufacturing GL / cost voucher (flag OFF).  
- Use dispatch pick/pack to “finish” the WO.
