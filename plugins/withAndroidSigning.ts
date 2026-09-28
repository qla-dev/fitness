import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

/**
 * Signs the Android release build with the project's upload key.
 *
 * Expo's template signs `release` with the DEBUG keystore, which Play rejects
 * outright, and `android/` is generated output — a fix made in build.gradle by
 * hand is gone the next time anyone runs prebuild. This plugin puts the fix in
 * the generator instead, so every regenerated project comes out signed.
 *
 * The key itself and its passwords stay OUT of this repository: the injected
 * block reads them from a properties file whose path is handed to Gradle as
 * `qlaSigningProperties` (set once in `~/.gradle/gradle.properties`, or passed
 * per build with `-PqlaSigningProperties=...`). With no such file the release
 * build keeps signing with the debug key exactly as before, so a clone that
 * has no key still builds — it just cannot be uploaded.
 */

/** The Gradle property naming the file that holds the key and its passwords. */
const PROPERTY = 'qlaSigningProperties';

const SIGNING_CONFIG = `        release {
            // Populated from the file named by the \`${PROPERTY}\` Gradle
            // property; see plugins/withAndroidSigning.ts. Left empty when
            // there is none, and the release build type falls back to debug.
            def qlaProps = new Properties()
            def qlaPath = project.findProperty('${PROPERTY}') ?: System.getenv('QLA_SIGNING_PROPERTIES')
            if (qlaPath && file(qlaPath).exists()) {
                file(qlaPath).withInputStream { qlaProps.load(it) }
            }
            if (qlaProps['storeFile']) {
                storeFile file(qlaProps['storeFile'])
                storePassword qlaProps['storePassword']
                keyAlias qlaProps['keyAlias']
                keyPassword qlaProps['keyPassword']
            }
        }
`;

const withAndroidSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(PROPERTY)) return config;

    // Add the release config beside the template's debug one.
    const anchor = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;
    if (!contents.includes(anchor)) {
      throw new Error(
        'withAndroidSigning: the template debug signingConfig was not found — ' +
          'the app/build.gradle template changed, so this plugin needs updating.'
      );
    }
    contents = contents.replace(anchor, anchor + SIGNING_CONFIG);

    // Point the release build type at it, falling back to debug when the key
    // is absent so a keyless checkout still produces an installable build.
    const releaseSigning = `            signingConfig signingConfigs.debug`;
    const releaseSigningIndex = contents.indexOf(
      'release {',
      contents.indexOf('buildTypes {')
    );
    if (releaseSigningIndex === -1) {
      throw new Error(
        'withAndroidSigning: no release buildType found in app/build.gradle.'
      );
    }
    const before = contents.slice(0, releaseSigningIndex);
    const after = contents
      .slice(releaseSigningIndex)
      .replace(
        releaseSigning,
        `            signingConfig signingConfigs.release.storeFile != null ? signingConfigs.release : signingConfigs.debug`
      );

    config.modResults.contents = before + after;
    return config;
  });

export default withAndroidSigning;
