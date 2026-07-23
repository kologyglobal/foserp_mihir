# Dispatch Legacy Compatibility (7C0 ↔ 7C5)

| Path | Behaviour |
|------|-----------|
| `BASIC_7C0` + `/confirm` | Soft policy; remains for thin confirm |
| `WORKBENCH_7C1` + `/confirm` | Hardened when `DISPATCH_HARDENED_POSTING_ENABLED` (closes bypass) |
| `WORKBENCH_7C1` + `/post` | Hardened gates |
| Historical CONFIRMED without pick/pack/challan | Remain valid; not retroactively invalidated (`LEGACY_POSTED` classification conceptual — status stays CONFIRMED) |

Both `/confirm` and `/post` route through `DispatchPostingService.postFgDispatch`.
