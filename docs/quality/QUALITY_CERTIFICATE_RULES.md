# Quality Certificate Rules (Phase 7B)

## Ownership

Quality owns certificate metadata, verification status, and PASS gates.
Attachments use the existing attachment service (no general DMS).

## Model

`QualityCertificate` — number, type, status (`PENDING` | `VERIFIED` | `REJECTED` | `EXPIRED`), optional inspection/item/lot/heat, issue/expiry, verifier.

## Gate

When an inspection or plan has `certificateRequired = true`:

- `PASS` / `CONDITIONAL_PASS` is blocked until at least one certificate on the inspection is `VERIFIED`
- Verification is an explicit API action (`POST /quality/certificates/:id/verify`) with `quality.approve` (or equivalent)
- Filename alone never auto-approves

## Types (informational)

Supplier test, material test, heat, dimensional, inspection report, pressure/leak/electrical, calibration reference, final QC, subcontract, other.

## Deferred

Calibration scheduling, instrument maintenance, laboratory LIMS, automatic expiry workflows beyond status flag.
