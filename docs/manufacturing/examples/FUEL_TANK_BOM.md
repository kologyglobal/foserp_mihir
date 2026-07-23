# Fuel Tank — Multilevel BOM

**BOM:** `BOM-FUEL-TANK-5000L`  
**Output:** `FG-FUEL-TANK-5000L` × 1 Nos  
**Version:** 1 → Certified (`ACTIVE`)

## Tree

```text
FG-FUEL-TANK-5000L
├── SFG-TANK-SHELL-5000L — 1 NOS — MAKE          (JC-SHELL)
│   ├── RM-MS-PLATE-006 — 620 KG — BUY           → SHELL-CUT
│   ├── CON-WELD-ER70S6 — 12 KG — BUY            → SHELL-WELD
│   └── CON-GAS-CO2 — 10 KG — BUY                → SHELL-WELD
├── SFG-DISHED-END-5000L — 2 NOS — MAKE          (JC-DISHED-END)
│   ├── RM-MS-PLATE-008 — 220 KG — BUY           → END-FORM
│   └── CON-WELD-E7018 — 4 KG — BUY              → END-FORM
├── SFG-SADDLE-SUPPORT-5000L — 1 SET — MAKE      (JC-SADDLE)
│   ├── RM-MS-PLATE-010 — 120 KG — BUY           → SADDLE-FAB
│   ├── RM-MS-ANGLE-50X50X6 — 45 KG — BUY        → SADDLE-FAB
│   └── CON-WELD-E7018 — 6 KG — BUY              → SADDLE-FAB
├── SFG-NOZZLE-MANHOLE-5000L — 1 SET — MAKE      (JC-NOZZLE)
│   ├── RM-MS-PIPE-DN50 — 2.5 MTR — BUY          → NOZZLE-FAB
│   ├── RM-MS-PIPE-DN25 — 1.5 MTR — BUY          → NOZZLE-FAB
│   ├── BO-* / CON-WELD-E7018 …                  → NOZZLE-FAB
├── SFG-FINAL-TANK-ASSY-5000L — 1 NOS — MAKE     (JC-FINAL-ASSEMBLY)
│   ├── SFG-* (logical inputs)                   → FINAL-ASSY
│   └── CON-FASTENER-MISC — 1 SET — BUY          → FINAL-ASSY
├── CON-PAINT-EPOXY-PRIMER — 12 LTR — BUY        → PAINTING
├── CON-PAINT-PU-TOPCOAT — 16 LTR — BUY          → PAINTING
└── CON-THINNER — 5 LTR — BUY                    → PAINTING
```

## Rules applied

- Every SFG line: `makeOrBuy=MAKE`, `lineType=SUBASSEMBLY`
- Purchased materials: `makeOrBuy=BUY`
- `childProductionOrderRequired=false` (LOGICAL pilot — Job Cards under FG WO only)
- Route links stored in `drawingReference` and linked via `issueOperationId` after route create
- Certified version is read-only; changes require Create Version

## Seed

`backend/scripts/seed-fuel-tank-mfg-setup.ts`
