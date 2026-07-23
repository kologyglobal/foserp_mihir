# Fuel Tank — Routing

**Route name:** 5000 Litre Fuel Tank Manufacturing Route  
**Code:** Auto via `MANUFACTURING_ROUTING` → seed created **`RT-000001`**  
**Production type:** `PARALLEL`  
**Version:** 1 Certified (`ACTIVE`)  
**Finished item:** `FG-FUEL-TANK-5000L`  
**Plant:** `MAIN-PLANT`

## Parallel rationale

Shell, Dished Ends, Saddle, and Nozzle Job Cards may run concurrently. Final Assembly waits for Shell + Ends (OP-80) then Saddle + Nozzle (OP-90). Test / paint / FG follow serially.

## Job Card stages (operation groups)

| Stage (JC) | Ops | Parallel |
|------------|-----|----------|
| JC-SHELL | 10, 20, 30 | Yes |
| JC-DISHED-END | 40, 50 | Yes |
| JC-SADDLE | 60 | Yes |
| JC-NOZZLE | 70 | Yes |
| JC-FINAL-ASSEMBLY | 80, 90 | No (merge) |
| JC-TEST-FINISH | 100–150 | No |

## Operation summary

| Op | Description | WC | Machine | QC plan | Route link | Predecessors |
|----|-------------|----|---------|---------|------------|--------------|
| 10 | Shell Plate Cutting | WC-CUTTING | M-CNC-PLASMA-01 | — | SHELL-CUT | — |
| 20 | Shell Rolling | WC-FORMING | M-ROLL-01 | QC-DIMENSIONAL-SHELL | SHELL-ROLL | 10 |
| 30 | Longitudinal Shell Welding | WC-WELDING | M-MIG-01 | QC-WELD-VISUAL-DPT | SHELL-WELD | 20 |
| 40 | Dished End Plate Cutting | WC-CUTTING | M-CNC-PLASMA-01 | — | END-FORM | — |
| 50 | Dished End Forming | WC-FORMING | M-PRESS-01 | QC-DISHED-END-DIMENSION | END-FORM | 40 |
| 60 | Saddle Support Fabrication | WC-FABRICATION | — | QC-SUPPORT-DIMENSION | SADDLE-FAB | — |
| 70 | Nozzle and Manhole Fabrication | WC-FABRICATION | M-SMAW-01 | QC-NOZZLE-ORIENTATION | NOZZLE-FAB | — |
| 80 | Shell and Dished End Assembly | WC-ASSEMBLY | — | QC-ASSEMBLY-DIMENSION | FINAL-ASSY | 30, 50 |
| 90 | Saddle and Nozzle Fitment | WC-ASSEMBLY | — | QC-FITMENT-CHECK | FINAL-ASSY | 60, 70, 80 |
| 100 | Hydrostatic and Leak Testing | WC-QUALITY | M-HYDRO-PUMP-01 | QC-HYDRO-LEAK-TEST | PRESSURE-TEST | 90 |
| 110 | Shot Blasting | WC-BLASTING | M-BLAST-01 | QC-SURFACE-PREP | FINAL-FINISH | 100 |
| 120 | Epoxy Primer (+ 8h wait note) | WC-PAINTING | M-PAINT-BOOTH-01 | QC-PAINT-DFT | PAINTING | 110 |
| 130 | PU Topcoat (+ 12h wait note) | WC-PAINTING | M-PAINT-BOOTH-01 | QC-PAINT-FINAL | PAINTING | 120 |
| 140 | Final Inspection | WC-QUALITY | — | QC-FINAL-FUEL-TANK | FINAL-FINISH | 130 |
| 150 | FG Receipt Readiness | WC-FG | — | — | FINAL-FINISH | 140 |

Wait/cure times are stored in `workInstructions` / description (no dedicated wait-time column).

## Dependencies

14 FINISH_TO_START mandatory dependencies — circular validation via routing certify rules.

See also: [ROUTE_MASTER.md](../ROUTE_MASTER.md), [ROUTE_VALIDATION_RULES.md](../ROUTE_VALIDATION_RULES.md).
