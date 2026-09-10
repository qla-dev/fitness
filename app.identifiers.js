// Shared identifiers used by both app.config.ts and Apple target configs
// (targets/*/expo-target.config.js). Keep as plain CommonJS — target configs
// can't load TypeScript/ESM.

const DEV_BUNDLE_IDENTIFIER =
  process.env.EXPO_DEV_BUNDLE_IDENTIFIER || 'fitness.qla.dev';

// The shipped identity. This used to read com.SparkyApps.SparkyFitnessMobile,
// left over from the fork: the credentials EAS actually provisions are
// fitness.qla.dev.widget and fitness.qla.dev.ExpoWidgetsTarget (see
// extra.eas.build.experimental.ios.appExtensions in app.json), so a production
// build under the old identifier would have asked for widget profiles that do
// not exist. Every embedded target derives its identifier from this.
const PROD_BUNDLE_IDENTIFIER =
  process.env.EXPO_PROD_BUNDLE_IDENTIFIER || 'fitness.qla.dev';
const IOS_APP_GROUP_DEV =
  process.env.IOS_APP_GROUP_DEV || `group.${DEV_BUNDLE_IDENTIFIER}`;
// Derived from the bundle identifier for the same reason the dev group is: the
// app group EAS provisions for both widget targets is group.fitness.qla.dev, so
// the old group.com.SparkyApps.SparkyFitnessMobile.shared value would have left
// a production build's widgets unable to read the app's shared container.
const IOS_APP_GROUP_PROD =
  process.env.IOS_APP_GROUP_PROD || `group.${PROD_BUNDLE_IDENTIFIER}`;

const isDevVariant = () => {
  const env = process.env.APP_VARIANT || 'dev';
  return env === 'dev' || env === 'development';
};

const getIosAppGroup = () =>
  isDevVariant() ? IOS_APP_GROUP_DEV : IOS_APP_GROUP_PROD;

module.exports = {
  DEV_BUNDLE_IDENTIFIER,
  PROD_BUNDLE_IDENTIFIER,
  IOS_APP_GROUP_DEV,
  IOS_APP_GROUP_PROD,
  isDevVariant,
  getIosAppGroup,
};
