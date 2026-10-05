import {
  ConfigPlugin,
  withAppBuildGradle,
  withDangerousMod,
  withSettingsGradle,
} from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Adds the Wear OS app as a second Gradle module.
 *
 * `android/` is generated output, so the watch module cannot live there: this
 * copies it out of `targets/android-wear/` on every prebuild and wires it into
 * the generated project, the same way `withCalorieWidget` places the home
 * screen widget. Nothing here is hand-edited in `android/`.
 *
 * The module is attached to the phone app through `wearApp project(':wear')`,
 * which is what makes Play deliver the watch APK inside the phone's bundle and
 * offer it on a paired watch.
 */

const SOURCE_DIR = 'targets/android-wear';
const MODULE_NAME = 'wear';
const TEMPLATE_SUFFIX = '.tmpl';

/**
 * Dependency versions, here rather than in the template so the one place that
 * knows about the watch build also knows what it builds against.
 */
const VERSIONS: Record<string, string> = {
  QLA_COMPOSE_BOM: '2026.03.01',
  QLA_WEAR_COMPOSE: '1.6.2',
  QLA_ACTIVITY_COMPOSE: '1.13.0',
  QLA_PLAY_WEARABLE: '20.0.1',
  QLA_HEALTH_SERVICES: '1.1.0',
  QLA_COROUTINES_PLAY: '1.11.0',
};

const substitute = (contents: string): string =>
  Object.entries(VERSIONS).reduce(
    (text, [token, version]) =>
      text.replace(new RegExp(`\\$${token}\\b`, 'g'), version),
    contents
  );

/**
 * Copied byte for byte rather than read as text.
 *
 * The tree carries the Ionicons font the watch draws its icons with, and a
 * font read as utf8 and written back is silently destroyed — every byte that
 * is not valid utf8 becomes U+FFFD, so the file still appears and still has a
 * plausible size. Extensions are listed rather than sniffed because the only
 * thing that decides this is whether `$TOKEN` substitution makes sense in the
 * file, and it never does for these.
 */
const BINARY_EXTENSIONS = new Set([
  '.ttf',
  '.otf',
  '.png',
  '.webp',
  '.jpg',
  '.jpeg',
  '.gif',
]);

async function copyTree(src: string, dest: string): Promise<void> {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await fs.promises.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, path.join(dest, entry.name));
      continue;
    }
    const name = entry.name.endsWith(TEMPLATE_SUFFIX)
      ? entry.name.slice(0, -TEMPLATE_SUFFIX.length)
      : entry.name;
    const to = path.join(dest, name);
    if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      await fs.promises.copyFile(from, to);
      continue;
    }
    const raw = await fs.promises.readFile(from, 'utf8');
    await fs.promises.writeFile(to, substitute(raw), 'utf8');
  }
}

const withWearApp: ConfigPlugin = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const source = path.join(projectRoot, SOURCE_DIR);
      const moduleRoot = path.join(platformRoot, MODULE_NAME);
      const mainRoot = path.join(moduleRoot, 'src/main');

      await fs.promises.mkdir(mainRoot, { recursive: true });

      // build.gradle and AndroidManifest.xml sit at their own levels, so they
      // are placed by name rather than by mirroring the source tree.
      for (const [file, dest] of [
        ['build.gradle.tmpl', path.join(moduleRoot, 'build.gradle')],
        ['AndroidManifest.xml.tmpl', path.join(mainRoot, 'AndroidManifest.xml')],
      ] as const) {
        const raw = await fs.promises.readFile(
          path.join(source, file),
          'utf8'
        );
        await fs.promises.writeFile(dest, substitute(raw), 'utf8');
      }

      await copyTree(
        path.join(source, 'kotlin'),
        path.join(mainRoot, 'java')
      );

      // Anything the watch module ships verbatim: the capability declaration
      // the phone queries to know our app is on the watch.
      const staticRes = path.join(source, 'res');
      if (fs.existsSync(staticRes)) {
        await copyTree(staticRes, path.join(mainRoot, 'res'));
      }

      // The watch app needs a name and a launcher icon of its own. Both are
      // taken from the phone module rather than duplicated, so a rebrand does
      // not leave the watch behind.
      const resDest = path.join(mainRoot, 'res/values');
      await fs.promises.mkdir(resDest, { recursive: true });
      await fs.promises.writeFile(
        path.join(resDest, 'strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_name">${
          config.name ?? 'qla.fit'
        }</string>\n</resources>\n`,
        'utf8'
      );

      for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
        // The template emits webp; png is accepted too, so both are tried
        // rather than assuming the format the generator happens to use.
        for (const extension of ['webp', 'png']) {
          const name = `ic_launcher.${extension}`;
          const from = path.join(
            platformRoot,
            `app/src/main/res/mipmap-${density}/${name}`
          );
          if (!fs.existsSync(from)) continue;
          const to = path.join(mainRoot, `res/mipmap-${density}`);
          await fs.promises.mkdir(to, { recursive: true });
          await fs.promises.copyFile(from, path.join(to, name));
          break;
        }
      }

      return config;
    },
  ]);

  config = withSettingsGradle(config, (config) => {
    if (!config.modResults.contents.includes(`':${MODULE_NAME}'`)) {
      config.modResults.contents += `\ninclude ':${MODULE_NAME}'\n`;
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(`wearApp project(':${MODULE_NAME}')`)) return config;

    // Into the existing dependencies block rather than appending a second one,
    // which Gradle accepts but which splits the app's dependencies in two.
    const marker = 'dependencies {';
    const at = contents.indexOf(marker);
    if (at === -1) {
      throw new Error(
        'withWearApp: no dependencies block in app/build.gradle — the ' +
          'template changed, so this plugin needs updating.'
      );
    }
    const insertAt = at + marker.length;
    config.modResults.contents =
      contents.slice(0, insertAt) +
      `\n    wearApp project(':${MODULE_NAME}')\n` +
      contents.slice(insertAt);
    return config;
  });

  return config;
};

export default withWearApp;
