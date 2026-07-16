# CSS Layout Fix Report

**Generated:** 2026-07-11

| Issue | Fix Applied | Status |
|-------|-------------|--------|
| Form save hidden below fold | .erp-form-footer-sticky + scrollable .erp-form-shell-content | Fixed |
| Drawer footer clipped | .erp-drawer-form-footer sticky in RightDrawer flex layout | Fixed |
| Command bar labels invisible until hover | CommandBar always shows labels + border on secondary | Fixed |
| Grid row actions hover-only | Removed opacity-0 from DataGrid row actions | Fixed |
| Select chevron orphan / truncated search | Select width on wrapper + SmartFilterBar layout | Fixed |

## Rules Enforced

- Sticky footer action bar always visible on long forms
- Drawer footer always visible with flex column layout
- Form content scrolls inside shell, not page overflow
- Safe-area padding on mobile drawer footer
