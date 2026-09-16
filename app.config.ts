import 'tsx/cjs';
import { ExpoConfig, ConfigContext } from 'expo/config';
import { nativeLanguageTags } from './src/localization/localeRegistry';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  getIosAppGroup,
  DEV_BUNDLE_IDENTIFIER,
  PROD_BUNDLE_IDENTIFIER,
} = require('./app.identifiers.js');

const APP_NAME = 'qla.fit';
const APP_SLUG = 'fitness';
const ANDROID_PROD_BUNDLE_IDENTIFIER = PROD_BUNDLE_IDENTIFIER;
const IOS_PROD_BUNDLE_IDENTIFIER = PROD_BUNDLE_IDENTIFIER;
const DEV_APPLE_TEAM_ID = process.env.EXPO_DEV_APPLE_TEAM_ID || '';
const PROD_APPLE_TEAM_ID = process.env.EXPO_PROD_APPLE_TEAM_ID || '';

const DEV_PACKAGE = DEV_BUNDLE_IDENTIFIER;
const PROD_PACKAGE = ANDROID_PROD_BUNDLE_IDENTIFIER;

const androidPermissions = [
  'android.permission.INTERNET',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_METABOLIC_RATE',
  'android.permission.health.READ_BLOOD_GLUCOSE',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_BODY_FAT',
  'android.permission.health.READ_BODY_TEMPERATURE',
  'android.permission.health.READ_BONE_MASS',
  'android.permission.health.READ_CERVICAL_MUCUS',
  'android.permission.health.READ_CYCLING_PEDALING_CADENCE',
  'android.permission.health.READ_EXERCISE',
  // Route data is gated separately from READ_EXERCISE and is granted per
  // session through requestExerciseRoute's system dialog; the blanket
  // READ_EXERCISE_ROUTES_ALL is a restricted permission Google grants only to
  // allowlisted apps. READ_HEALTH_DATA_IN_BACKGROUND does not cover routes.
  'android.permission.health.READ_EXERCISE_ROUTES',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_ELEVATION_GAINED',
  'android.permission.health.READ_FLOORS_CLIMBED',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_HEIGHT',
  'android.permission.health.READ_HYDRATION',
  'android.permission.health.READ_NUTRITION',
  'android.permission.health.READ_LEAN_BODY_MASS',
  'android.permission.health.READ_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.READ_MENSTRUATION',
  'android.permission.health.READ_OVULATION_TEST',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_POWER',
  'android.permission.health.READ_RESPIRATORY_RATE',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_SPEED',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_STEPS_CADENCE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_VO2_MAX',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_WHEELCHAIR_PUSHES',
  'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
  // Writeback (qla.fit → Health Connect): nutrition + water. Production feature,
  // so these live in the base list (not the dev-only writes below).
  'android.permission.health.WRITE_NUTRITION',
  'android.permission.health.WRITE_HYDRATION',
  // Exact rest-complete alerts: without this special access (user-granted via
  // "Alarms & reminders" on Android 13+), expo-notifications falls back to
  // inexact alarms that the OS batches ~15s late.
  'android.permission.SCHEDULE_EXACT_ALARM',
];

const devAndroidPermissions = [
  'android.permission.health.WRITE_ACTIVE_CALORIES_BURNED',
  'android.permission.health.WRITE_BASAL_BODY_TEMPERATURE',
  'android.permission.health.WRITE_BASAL_METABOLIC_RATE',
  'android.permission.health.WRITE_BLOOD_GLUCOSE',
  'android.permission.health.WRITE_BLOOD_PRESSURE',
  'android.permission.health.WRITE_BODY_FAT',
  'android.permission.health.WRITE_BODY_TEMPERATURE',
  'android.permission.health.WRITE_BONE_MASS',
  'android.permission.health.WRITE_CERVICAL_MUCUS',
  'android.permission.health.WRITE_CYCLING_PEDALING_CADENCE',
  'android.permission.health.WRITE_EXERCISE',
  'android.permission.health.WRITE_EXERCISE_ROUTE',
  'android.permission.health.WRITE_DISTANCE',
  'android.permission.health.WRITE_ELEVATION_GAINED',
  'android.permission.health.WRITE_FLOORS_CLIMBED',
  'android.permission.health.WRITE_HEART_RATE',
  'android.permission.health.WRITE_HEIGHT',
  // WRITE_HYDRATION moved to the base androidPermissions list (writeback feature).
  'android.permission.health.WRITE_LEAN_BODY_MASS',
  'android.permission.health.WRITE_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.WRITE_MENSTRUATION',
  'android.permission.health.WRITE_OVULATION_TEST',
  'android.permission.health.WRITE_OXYGEN_SATURATION',
  'android.permission.health.WRITE_POWER',
  'android.permission.health.WRITE_RESPIRATORY_RATE',
  'android.permission.health.WRITE_RESTING_HEART_RATE',
  'android.permission.health.WRITE_SLEEP',
  'android.permission.health.WRITE_SPEED',
  'android.permission.health.WRITE_STEPS',
  'android.permission.health.WRITE_STEPS_CADENCE',
  'android.permission.health.WRITE_TOTAL_CALORIES_BURNED',
  'android.permission.health.WRITE_VO2_MAX',
  'android.permission.health.WRITE_WEIGHT',
  'android.permission.health.WRITE_WHEELCHAIR_PUSHES',
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./package.json');

export default ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const environment = process.env.APP_VARIANT || 'dev';

  const isDev = environment === 'dev' || environment === 'development';

  // Single source of truth for the linked EAS project: the update URL is
  // derived from the same id EAS Build already reads out of app.json.
  const easProjectId = (config.extra as { eas?: { projectId?: string } })
    ?.eas?.projectId;

  if (isDev) {
    androidPermissions.push(...devAndroidPermissions);
  }

  // Plugins only included in production builds
  const prodPlugins = ['./plugins/withNetworkSecurityConfig'];

  return {
    ...config,
    name: APP_NAME,
    slug: APP_SLUG,
    version: packageJson.version,
    // OTA updates. Deliberately NOT the fingerprint policy: this project uses
    // continuous native generation, so EAS runs prebuild on the worker and then
    // hashes the ios/ it just generated as a "bareNativeDir" source, while a
    // machine that never prebuilds has nothing there to hash. The two can never
    // agree, and .fingerprintignore does not suppress that source. On top of
    // that, project.pbxproj is not byte-stable across prebuilds
    // (expo/expo#34195), so even matching both sides would still drift.
    //
    // appVersion trades that for one rule: bump `version` in package.json
    // whenever a build ships native changes, or an old build will accept JS it
    // cannot run.
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
      // A cold start must not block on the network; a downloaded update is
      // applied on the next launch instead.
      fallbackToCacheTimeout: 0,
    },
    locales: Object.fromEntries(
      nativeLanguageTags().map((language) => [
        language,
        `./locales/${language}.json`,
      ])
    ),
    ios: {
      // Keep app.json's ios block (buildNumber, which EAS autoIncrement writes
      // there). Without this spread it was dropped and every build shipped as
      // build 1, which App Store Connect rejects as already used.
      ...config.ios,
      bundleIdentifier: isDev
        ? DEV_BUNDLE_IDENTIFIER
        : IOS_PROD_BUNDLE_IDENTIFIER,
      appleTeamId: isDev ? DEV_APPLE_TEAM_ID : PROD_APPLE_TEAM_ID,
      supportsTablet: false,
      // Adds the Sign in with Apple capability/entitlement that
      // expo-apple-authentication needs; without it the button throws at
      // runtime on a real build.
      usesAppleSignIn: true,
      infoPlist: {
        // Keeps location updates flowing while a run/ride is recording and the
        // app is backgrounded or the screen is locked. iOS stops delivering
        // them entirely without this mode, so the route would simply stop.
        // `bluetooth-central` is required by the BLE sensor client, which is
        // created with a `restoreStateIdentifier`: CoreBluetooth throws
        // NSInternalInconsistencyException at `createClient` when state
        // restoration is requested without this mode. The react-native-ble-plx
        // plugin below appends it too; it is spelled out here so the two
        // background modes this app relies on are visible in one place.
        UIBackgroundModes: ['location', 'bluetooth-central'],
        NSLocalNetworkUsageDescription:
          'qla.fit connects to self-hosted servers on your local network.',
        // Required by the food/meal photo picker and the label/barcode
        // scanner. iOS terminates the app on first use without these, and App
        // Review rejects a binary that requests either without a purpose
        // string.
        NSCameraUsageDescription:
          'qla.fit uses the camera to photograph foods and meals, and to scan barcodes and nutrition labels.',
        NSPhotoLibraryUsageDescription:
          'qla.fit lets you choose photos from your library for your foods, meals, and diary entries.',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
        ITSAppUsesNonExemptEncryption: false,
        // Keep the native per-app Language entry visible in iOS Settings even
        // when the device has only one preferred system language.
        UIPrefersShowingLanguageSettings: true,
        // The localized InfoPlist permission strings come from `locales`; this
        // allows the generated app metadata to use the selected localization.
        CFBundleAllowMixedLocalizations: true,
      },
      entitlements: {
        'com.apple.security.application-groups': [getIosAppGroup()],
      },
      // The flat artwork: a single composed square with the brand's black
      // ground baked in, which is the opposite of what a .icon document's
      // transparent layers expect.
      icon: './assets/icons/appicon.jpg',
    },
    android: {
      // Same as ios: keep app.json's versionCode from autoIncrement.
      ...config.android,
      package: isDev ? DEV_PACKAGE : PROD_PACKAGE,
      permissions: androidPermissions,
      adaptiveIcon: {
        // One flat artwork feeds every icon surface: the same opaque square
        // with the brand's black ground baked in, carrying no alpha channel
        // (the App Store rejects an icon that has one, even fully opaque).
        // The launcher mask crops the outer third of this foreground, which
        // the mark's own margin absorbs; the background repaints the same
        // black so the cropped edge cannot show through.
        foregroundImage: './assets/icons/appicon.jpg',
        backgroundColor: '#000000',
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      'expo-image',
      [
        // Foreground playback only (rest-timer chime): no mic permission, no
        // background-audio mode, no Android record/foreground-service perms.
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
        },
      ],
      [
        // Native maps: Apple Maps on iOS, Google Maps on Android.
        //
        // Location permission is deliberately NOT requested here. Nothing in
        // the app needs the device's position yet, and a health app that asks
        // for location it never uses invites store-review questions. Flip
        // `requestLocationPermission` on (with a usage string) when a feature
        // actually shows the user where they are.
        'expo-maps',
        { requestLocationPermission: false },
      ],
      // Sign in with Apple. expo-auth-session needs no plugin of its own — it
      // redirects through the app `scheme` already declared above.
      'expo-apple-authentication',
      [
        // GPS, for recording a run or ride.
        //
        // Android takes the foreground-service route, NOT
        // ACCESS_BACKGROUND_LOCATION: recording starts from a button with the
        // app on screen, and a foreground service then keeps it going with the
        // screen off. That covers the feature while avoiding Play's
        // background-location declaration (written justification plus a demo
        // video, reviewed per submission).
        //
        // iOS permission strings are the English fallbacks; the localized copy
        // lives in `locales/*.json` beside the camera and Health strings.
        'expo-location',
        {
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: false,
          locationWhenInUsePermission:
            'qla.fit uses your location to map and measure your runs and rides.',
          locationAlwaysAndWhenInUsePermission:
            'qla.fit uses your location to keep recording your route while the app is in the background.',
        },
      ],
      [
        // Bluetooth LE, for fitness sensors (heart-rate straps, cadence and
        // power meters).
        //
        // Continue fitness-sensor notifications during a run/ride with the
        // screen locked. Discovery remains explicitly user initiated.
        //
        // The iOS usage string is the English fallback; the localized copy
        // lives in `locales/*.json` alongside the camera and Health strings,
        // and wins wherever a translation exists.
        'react-native-ble-plx',
        {
          // iOS background BLE comes from `modes` alone. `isBackgroundEnabled`
          // is Android-only in this plugin and its sole effect is
          // `<uses-feature android:name="android.hardware.bluetooth_le"
          // android:required="true"/>`, which tells Play to hide the app from
          // every device without BLE. Sensors are one optional corner of a
          // nutrition app, so it stays off; Android keeps notifications flowing
          // through the recording foreground service, not this flag.
          isBackgroundEnabled: false,
          modes: ['central'],
          bluetoothAlwaysPermission:
            'qla.fit uses Bluetooth to connect to fitness sensors such as heart-rate monitors.',
        },
      ],
      './plugins/withGlanceAndroidSupport',
      './plugins/withAppLanguage',
      './plugins/withCalorieWidget',
      './plugins/withExactAlarmModule',
      './plugins/withEnrichedMarkdownNoMath',
      [
        'expo-localization',
        {
          supportedLocales: {
            ios: nativeLanguageTags(),
            android: nativeLanguageTags(),
          },
        },
      ],
      [
        'expo-widgets',
        {
          groupIdentifier: getIosAppGroup(),
          bundleIdentifier:
            process.env.WIDGET_BUNDLE_IDENTIFIER ||
            (isDev
              ? `${DEV_BUNDLE_IDENTIFIER}.ExpoWidgetsTarget`
              : `${PROD_BUNDLE_IDENTIFIER}.ExpoWidgetsTarget`),
          // Live Activities register at runtime via createLiveActivity and must
          // NOT be listed here — widgets[] is only for home/Lock Screen widgets
          // (an entry without supportedFamilies breaks the generated target).
          widgets: [],
        },
      ],
      ...(!isDev ? prodPlugins : []),
    ],
    extra: {
      ...config.extra,
      APP_VARIANT: environment,
      // Local (AsyncStorage) is the shipping data mode for every variant. This
      // used to fall back to 'server' whenever APP_VARIANT was not a dev one,
      // so TestFlight/production builds silently ran against the backend while
      // dev builds ran locally. Only FITNESS_DATA_MODE flips it now.
      dataMode: process.env.FITNESS_DATA_MODE || 'local',
      iosAppGroup: getIosAppGroup(),
    },
  };
};
