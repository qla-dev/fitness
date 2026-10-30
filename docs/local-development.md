# Development and diary storage

All build profiles use the same on-device SQLite diary. There is no data-mode
setting or environment flag. Development clients load JavaScript from Metro:

```powershell
eas build -p ios --profile development
pnpm exec expo start --dev-client
```

Apple signing and device registration are handled by EAS. If needed, set
`EXPO_DEV_APPLE_TEAM_ID` for your Apple team.

Diary data persists in `fitness-local.db` through `src/services/local/localStore.ts`.
AsyncStorage holds preferences and small settings. The run/ride recorder has its
own SQLite database. Existing AsyncStorage diary snapshots migrate to SQLite
without resetting the database; the old copy is removed only after verification.
Food, meal and progress-photo files stay in the app document directory.
Uninstalling the app removes its on-device data.

`apiClient.ts` sends diary operations to `localApiFetch`; `/api/...` strings in
those calls are repository routing keys. Health imports use the same repository.
Unknown operations fail explicitly and never fall through to a self-hosted
server. Supported features include food/meal tracking, hydration, measurements,
exercise/workouts, health imports, meal plans, progress photos, medications,
cycle and pregnancy tracking. Legacy fasting and label/photo scanner adapters
remain unimplemented. Barcode lookup uses Open Food Facts; meal-photo analysis
is available in MarkAI.

The first screen offers Apple sign-in whenever signed out and can be dismissed.
An online account enables optional Laravel sync and MarkAI through the separate
`src/services/online` clients. Online sync defaults to enabled after sign-in,
with a requested 15-minute interval and best-effort background scheduling.
Production API base: `https://fit.qla.dev/endpoints/api`.

## Provider catalogs

The app queries Free Exercise DB and Open Food Facts directly. Their provider
rows are initialized in the diary. Catalog requests run before the serialized
`localTransaction` queue so network calls do not block diary reads and writes.
Imports save through the repository; exercise import is idempotent on
`(source, source_id)`. Provider images remain upstream URLs.

The on-device storage settings can export a JSON snapshot. Photo paths are
included, but image bytes are not. The changes list is a capped debugging trail,
not an online sync journal. Online sync reads diary tables through
`localTransaction` and applies its own conflict handling.
