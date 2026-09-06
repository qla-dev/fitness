# Local development data

The `development` EAS profile uses `fitness.qla.dev` and `FITNESS_DATA_MODE=local`.
It opens directly into the app without a server account. Starting Metro with the
default configuration also selects local mode.

```powershell
eas build -p ios --profile development
pnpm exec expo start --dev-client
```

The development client still loads JavaScript from Metro. “Local” means no
SparkyFitness backend; it does not turn a development client into a standalone
release build. Apple signing and device registration are handled by EAS. If
requested, provide your Apple team through `EXPO_DEV_APPLE_TEAM_ID`.

Supported local data: saved foods and variants, manual diary entries, meal
templates and logged meals, hydration, check-in/custom measurements, custom
exercises, workout presets, workout/activity sessions, and preferences. Data is
stored under `@Fitness/local-database/v1` in AsyncStorage. Food/meal pictures are
copied into the app's document directory. App preferences and workout drafts keep
their existing storage. Uninstalling the app removes its local data.

AI, online providers, health ingestion/writeback, recurring meal plans,
medications, cycle/pregnancy, progress photos, and nested meal templates are not
implemented by this local adapter. Their main dashboard/add/library entry points
are hidden where applicable; unsupported requests fail explicitly and never
fall through to HTTP. Starter nutrition goals are display defaults, not a
personalized plan.

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
