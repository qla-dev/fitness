/* global __dirname */
const {
  isDevVariant,
  DEV_BUNDLE_IDENTIFIER,
  PROD_BUNDLE_IDENTIFIER,
} = require('../../app.identifiers.js');
const fs = require('fs');
const path = require('path');

const escapePlistString = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * The `watch` target type contributes an empty Info.plist, so every key the
 * watch app needs is written here. `WKCompanionAppBundleIdentifier` must be the
 * phone app's identifier for the pair to be recognized, which is why it follows
 * the same dev/prod split as the phone target rather than being hardcoded.
 */
const syncInfoPlist = (companionBundleIdentifier) => {
  const companion = escapePlistString(companionBundleIdentifier);
  fs.writeFileSync(
    path.join(__dirname, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>qla.fitWatch</string>
    <key>WKApplication</key>
    <true/>
    <key>WKCompanionAppBundleIdentifier</key>
    <string>${companion}</string>
    <key>WKRunsIndependentlyOfCompanionApp</key>
    <false/>
    <key>WKBackgroundModes</key>
    <array>
      <string>workout-processing</string>
    </array>
    <key>NSHealthShareUsageDescription</key>
    <string>qla.fit reads your heart rate on Apple Watch so your runs and rides show live heart-rate data.</string>
    <key>NSHealthUpdateUsageDescription</key>
    <string>qla.fit saves the workout it records on Apple Watch to Apple Health.</string>
  </dict>
</plist>
`
  );
};

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => {
  const isDev = isDevVariant();
  const companionBundleIdentifier = isDev
    ? DEV_BUNDLE_IDENTIFIER
    : PROD_BUNDLE_IDENTIFIER;
  syncInfoPlist(companionBundleIdentifier);

  return {
    type: 'watch',
    name: 'qlafitWatch',
    displayName: 'qla.fitWatch',
    bundleIdentifier: `${companionBundleIdentifier}.watchkitapp`,
    icon: '../../assets/icons/logo-v3.jpg',
    deploymentTarget: '10.0',
    frameworks: ['HealthKit', 'WatchConnectivity'],
    entitlements: {
      'com.apple.developer.healthkit': true,
    },
  };
};
