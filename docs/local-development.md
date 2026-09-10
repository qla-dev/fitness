# Local development data

The `development` EAS profile uses `fitness.qla.dev` and `FITNESS_DATA_MODE=local`.
It opens directly into the app without a server account. Starting Metro with the
default configuration also selects local mode.

```powershell
eas build -p ios --profile development
pnpm exec expo start --dev-client
```

The development client still loads JavaScript from Metro. “Local” means no
qla.fit backend; it does not turn a development client into a standalone
release build. Apple signing and device registration are handled by EAS. If
requested, provide your Apple team through `EXPO_DEV_APPLE_TEAM_ID`.

Supported local data: saved foods and variants, manual diary entries, meal
templates and logged meals, hydration, check-in/custom measurements, custom
exercises, workout presets, workout/activity sessions, and preferences. Data is
stored under `@Fitness/local-database/v1` in AsyncStorage. Food/meal pictures are
copied into the app's document directory. App preferences and workout drafts keep
their existing storage. Uninstalling the app removes its local data.

AI (chat, photo estimates, label scan), health ingestion/writeback, recurring
meal plans, medications, cycle/pregnancy, progress photos, and nested meal
templates are not implemented by this local adapter. Their main dashboard/add/
library entry points are hidden where applicable; unsupported requests fail
explicitly and never fall through to HTTP. Starter nutrition goals are display
defaults, not a personalized plan.

## Provider catalogs

The libraries start empty: qla.fit ships no bundled food or exercise
catalog, and the server does not hold one either — it proxies public APIs and
creates a provider row per user at signup. Those APIs need no key, so
`providerCatalog.ts` calls them from the device and `initialise()` seeds the
matching provider rows.

| Provider | Source | Covers |
| --- | --- | --- |
| Free Exercise DB | `raw.githubusercontent.com/yuhonas/free-exercise-db` | exercise search and import |
| Open Food Facts | Search-a-licious + Product Opener | food search, details, barcode |

Only these two are seeded, so no picker offers a source that cannot answer.
wger is left out on purpose: its importer needs the id-to-name lookups the
server keeps in `wgerNameMapping`, and Free Exercise DB already covers the
exercise catalog. Searching an unimplemented provider raises the same explicit
"a backend is required" error as any other unsupported request.

These calls run in `catalogRoute` **before** `localTransaction` opens, because
that transaction serializes the whole database behind one queue and awaiting a
remote call inside it would stall every other read and write. Imports write
through the normal local endpoints, so they land in the mutation journal as
ordinary creates and a failed fetch leaves nothing behind. Exercise import is
idempotent on `(source, source_id)`, mirroring the server's unique index.

Images stay as upstream URLs rather than being copied locally: the server
downloads them because its clients fetch images through it, while
`useExerciseImageSource` and `useFoodImageSource` hand absolute URLs straight to
`expo-image`. Calories per hour for an imported exercise use the server's MET
table against the latest recorded weight (70kg when there is none); the server's
age and gender adjustments are skipped because the local profile has neither.

Settings → On-device storage → Export local data shares a JSON snapshot with
schema version, device/user IDs, tables, and the ordered mutation journal. Images
are referenced by their on-device paths; the JSON export does not contain image
bytes. Export is manual and does not upload or share anything until the system
share sheet is used.

## Future backend integration

`apiClient.ts` routes existing service calls to the local adapter before checking
server credentials. The HTTP adapter is preserved. Set `FITNESS_DATA_MODE=server`
and restart Metro (or use a server-mode build) to use the original server flow.
Local data stays separate; selecting server mode does **not** migrate or upload it.

The local database uses UUIDs for entities and a persistent numeric sequence for
workout sets/presets to match the existing wire contracts. Writes are serialized;
records and their mutation journal commit in one AsyncStorage write. Storage
errors reject the operation, and malformed/unknown database versions are never
silently reset. Shared workout response schemas validate local workout results.

A future importer must authenticate the target account, map local ownership and
numeric IDs, upload image bytes, create entities in dependency order, and track
journal operation UUIDs for idempotency. It must define conflict resolution before
enabling automatic synchronization. No automatic sync or conflict policy is
claimed by this implementation.

Validation logs are in `.expo/local-*.log`. No native build is needed to run the
storage and adapter tests in `__tests__/services/localData.test.ts`.
