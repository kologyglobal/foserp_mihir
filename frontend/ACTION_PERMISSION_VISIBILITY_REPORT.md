# Action Permission Visibility Report

**Generated:** 2026-07-11

## Rules

- `ErpButton.disabledReason` shows tooltip when action disabled
- `Entity360Shell.lockedReason` hides Edit and shows lock banner
- `ErpCommandBar` supports `hidden` and `disabledReason` per action
- CEO/Admin roles see all actions via RBAC (`test:rbac` in CI)

## Implementation

| Pattern | Component |
|---------|-----------|
| Unauthorized → hidden/disabled | `ErpCommandBar` action.hidden |
| Locked document | `lockedReason` on Entity360Shell |
| Disabled save | `submitDisabledReason` on ErpFormFooter |
