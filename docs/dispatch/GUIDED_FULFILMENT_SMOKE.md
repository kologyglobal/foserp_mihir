# Guided Fulfilment — WO → Dispatch smoke checklist

Short operator path for Produce → Quality → Stock → Dispatch (API mode).

## Entry

- Control Room or Store Workbench → **Fulfilment** → `/manufacturing/guided-fulfilment?step=…`
- Or open a Work Order / Sales Order — same strip; progress is in `?step=`

## Smoke (happy path)

1. **Produce** — Open linked WO → Complete Stage(s) → Complete WO  
2. **Quality** — Clear any QC pending / open issues (flexible mode warns, does not hard-block)  
3. **Stock** — Receive Finished Goods on the WO  
4. **Dispatch** — SO Fulfilment → Sync requirements → Create draft outbound  
5. **7C5** — Reserve → Pick → Pack → Issue challan → **Post Dispatch** (Auto Mode opens next screen after each success)  
6. **Refresh** — Reload WO/SO/Guided Fulfilment URL; `?step=` still highlights the coach step  

## Quick checks

| Check | Expect |
|-------|--------|
| Auto Mode On after Reserve | Opens pick mode |
| Auto Mode On after Pick complete | Opens packing |
| Auto Mode On after Pack complete | Opens challan |
| Issue challan | Returns to outbound `?focus=post` |
| Post Dispatch | Outbound `CONFIRMED`; SO dispatched qty increases |

## Notes

- Soft Basic Confirm remains for `BASIC_7C0` drafts; workbench drafts use hardened **Post (7C5)**.  
- Challan issue is document-only (no stock until Post).  
- Detailed 7C5 UAT: `docs/dispatch/PHASE7C5_UAT_RESULTS.md`
