# Mobile Design System (M1)

## Product direction

Align with FOS CRM web: **white surfaces**, **blue primary**, soft borders, rounded cards, compact spacing, **minimal shadow**. No gradients, no glassmorphism, no purple AI chrome.

## Tokens (`src/theme/tokens.ts`)

| Token | Value |
|-------|-------|
| Background | `#FFFFFF` |
| Primary | `#2563EB` |
| Border | `#E5E7EB` |
| Text | `#111827` / secondary `#4B5563` |
| Radius card | 12 |
| Spacing scale | 2–32 |

## Components

| Component | Role |
|-----------|------|
| `AppHeader` | Title + optional back / right slot |
| `PrimaryButton` / `SecondaryButton` | Actions |
| `AppCard` | Rounded bordered surface |
| `StatusChip` | Status / module tags |
| `Avatar` | Initials or photo URL |
| `InfoTile` | Profile / kv tile |
| `MetricCard` | Home metrics |
| `SearchBar` | Filter entry (future lists) |
| `EmptyState` | Empty / coming soon |
| `Loading` | Spinner + label |
| `Skeleton` / `SkeletonCard` | Placeholder loading |
| `BottomSheet` | Modal sheet |
| `ConfirmDialog` | Confirm / destructive |
| `Timeline` | Vertical events |
| `FormField` | Labelled text input |
| `ErrorState` / `OfflineBanner` | Resilience |

## Layout

- Phone-first; tablet content max width ~720.
- Portrait priority (`orientation: portrait` in app config); tablets supported.
- Bottom tabs for product shell only.

## Forms

React Hook Form + Zod resolvers; field errors under inputs; API field errors via `ApiError.fieldErrors`.
