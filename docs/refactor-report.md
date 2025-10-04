# Safe Optimize Refactor Report

This report tracks the "zero behavior change" cleanup & optimizations.

## Scope
- No public API signature changes
- No DB schema changes
- No UI/UX changes (styles kept intact)

## Metrics
- First Load JS / Bundle size (before -> after):
- LCP / CLS / TTFB:
- Build time:
- Node modules size:
- Dependency count:

## Deletions (with evidence)
- Files removed (path, reason, references/trace proofs):

## Tools & Commands
- Static: `ts-prune`, `depcheck`, Next.js analyzer
- Dynamic: Playwright smoke E2E traces

## How to rollback
- Revert PR or `git revert` the merge commit

## Checklists
- [ ] Typecheck OK
- [ ] Lint OK
- [ ] Build OK
- [ ] E2E OK
- [ ] Bundle diff within ±5%


## Findings Snapshot (2025-10-04)

### Unused Dependency Candidates (depcheck)
- @heroicons/react (verify)
- @types/node (types tooling; keep for now)
- @types/react-dom (types tooling; keep for now)
- autoprefixer (tooling; tailwind/postcss pipeline present -> keep)
- bcrypt (unused, code uses bcryptjs) -> REMOVED
- date-fns (verify usage; appears referenced in code)
- postcss (tooling; keep)
- tailwindcss (tooling; keep)

Notes: `tailwind.config.js` and `postcss.config.js` exist, so Tailwind/PostCSS/Autoprefixer are part of the build pipeline and should remain.

### Unused Exports (ts-prune highlights)
- src/lib/title-utils.ts: `updateAllTitles` (planned-use for cumulative renumber) -> keep, annotate
- src/lib/auth-utils.ts: `getCalendarId` (verify)
- src/lib/validations.ts: `createReservationSchema`, `validateReservationDuration`, `calculateEndTime` (verify)
- src/components/ui/StatusBadge.tsx, `SuccessMessage.tsx` (verify consumers)

Build-artifact paths under `.next/types/...` are ignored.

### Dynamic Rendering Adjustments
- Added `export const dynamic = 'force-dynamic'` for APIs using auth/headers to avoid static prerender conflicts:
  - `src/app/api/reservations/route.ts`
  - `src/app/api/user/profile/route.ts`
  - `src/app/api/reservations/monthly-count/route.ts`
  - `src/app/api/user/reservations/route.ts`
  - `src/app/api/clients/route.ts`
- Wrapped `src/app/admin/reservations/new/page.tsx` in `<Suspense>` and split content to satisfy CSR bailout requirements.

### Bundle Analyze Snapshot
- Generated reports under `.next/analyze/` via `npm run analyze`.
- First Load JS (shared): ~87.1 kB (see analyzer HTML for details)

### Completed Safe Deletions
- Removed dependency: `bcrypt` (reason: codebase uses `bcryptjs` exclusively).

### Next Steps
- Vet `date-fns` usage thoroughly; if used, remove from candidate list.
- Verify `getCalendarId` and UI components usage; deprecate or delete only with 100% certainty.
- Add CI workflow to enforce `ci:all` and (optionally) bundle-size gate.

