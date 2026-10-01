# AGENTS.md

*Last updated: 2026-07-08*

`@workspace/shared` is a source-first TypeScript workspace library package for schemas, constants, and timezone/day helpers consumed by the qla.fit mobile app (the package root). It was inherited from the upstream project, where a server and web frontend consumed it too; those are no longer part of this workspace.

## Scope

- This package defines contracts and shared logic, not an app.
- Validate changes from the consuming mobile app, not in isolation.
- The `../backend` Laravel app mirrors record collections separately; keep collection shapes aligned with it when a synced schema changes.

## Structure

- `src/schemas/database/` - one Zod file per table (`Foods.zod.ts`, `Exercises.zod.ts`, ~60 files). Agent shortcut: to learn a table shape, read the matching file here instead of the SQL dump.
- `src/schemas/api/` - API request/response contracts (`*api.zod.ts`).
- `src/constants/` - shared constants and enums (exercises, nutrients, meal types, fasting protocols, medication schedules, cycle phases, etc.).
- `src/utils/` - timezone helpers (`todayInZone`, `instantToDay`, `dayToUtcRange`, `compareDays`, `addDays`, `isDayString`), cycle/menstruation helpers, and unit/calculation utilities.
- `src/ai/`, `src/cycle/`, `src/medications/`, `src/mood/` - domain-specific helpers.

## Naming Convention

- `X.api.zod.ts` = API request/response schema
- `X.zod.ts` = database table schema
- Export everything from `src/index.ts`; consuming packages import both types and values via `@workspace/shared`

## Cross-Package Contract Rules

- Changes to `src/schemas/api/` affect the mobile API clients and the local `localApi.ts` router.
- Changes to `src/schemas/database/` describe row shapes existing installs already hold, on device and in the sync backend; keep older rows readable.
- Timezone/day-string helpers prevent bugs; prefer them over `toISOString().split('T')[0]`.
- Test any shared change from the mobile app (`pnpm run validate` at the package root) after modifying shared.

## Working Rules

- Keep this package export-focused and schema-focused; logic that scales should live in consuming packages.
- Never export stale or unfinished types; if a consumer is drafting code and needs a type not yet here, add it.
