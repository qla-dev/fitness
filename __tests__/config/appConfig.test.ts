import fs from 'fs';
import path from 'path';

describe('Expo native language configuration', () => {
  it('retains the native locale configuration and localized metadata settings', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app.config.ts'),
      'utf8'
    );
    expect(source).toContain('nativeLanguageTags()');
    expect(source).toContain('supportedLocales');
    expect(source).not.toContain("ios: ['en', 'pl']");
    expect(source).not.toContain("android: ['en', 'pl']");
    expect(source).toContain('UIPrefersShowingLanguageSettings: true');
    expect(source).toContain('CFBundleAllowMixedLocalizations: true');
  });
});

describe('iOS background modes', () => {
  it('declares bluetooth-central alongside location', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app.config.ts'),
      'utf8'
    );
    // CoreBluetooth throws NSInternalInconsistencyException at client
    // creation when a `restoreStateIdentifier` is passed (see
    // `src/services/recording/sensors.ts`) and the app has not declared the
    // `bluetooth-central` background mode.
    expect(source).toContain(
      "UIBackgroundModes: ['location', 'bluetooth-central']"
    );
  });
});

describe('brand assets', () => {
  const read = (relative: string) =>
    fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');

  it('states one brand ground everywhere it is written by hand', () => {
    // The mark is drawn for black. The splash sits directly behind the glyph
    // and the Android adaptive-icon background sits behind the same glyph
    // again, so a second near-miss shade would show as a seam.
    const GROUND = '#000000';
    expect(read('src/components/AppLogo.tsx')).toContain(
      `BRAND_GROUND = '${GROUND}'`
    );
    expect(read('app.config.ts')).toContain(`backgroundColor: '${GROUND}'`);
    expect(read('app.json')).toContain(`"backgroundColor": "${GROUND}"`);
    // The retired blue-square identity, in either of the two shades it was
    // written as.
    for (const file of ['app.config.ts', 'app.json'])
      expect(read(file)).not.toMatch(/#0[12]8[FE]F[ED]/i);
  });

  it('draws the accent figure in the app accent, not the artwork cyan', () => {
    // The mark ships recoloured to --color-accent-primary; the constant here is
    // what the asset was generated from, so the two cannot drift silently.
    expect(read('global.css')).toContain(
      '--color-accent-primary: hsl(220, 91%, 64%)'
    );
    expect(read('src/components/AppLogo.tsx')).toContain(
      "BRAND_ACCENT = '#5087F7'"
    );
  });

  it('paints the splash and the in-app mark from one logo asset', () => {
    // Both sit the same white-on-transparent glyph on the same blue, so the
    // launch screen and the mark cannot drift apart.
    expect(read('app.json')).toContain('"./assets/images/logo.png"');
    expect(read('src/components/AppLogo.tsx')).toContain(
      "require('../../assets/images/logo.png')"
    );
  });

  it('renders the mark through AppLogo rather than a per-screen require', () => {
    // The retired SparkyFitness artwork survived the rebrand on two screens
    // because each held its own require. One component owns the mark now.
    for (const screen of [
      'src/screens/AboutScreen.tsx',
      'src/screens/OnboardingScreen.tsx',
    ]) {
      expect(read(screen)).toContain("from '../components/AppLogo'");
      expect(read(screen)).not.toMatch(/require(.*assets.*logo.png.*)/);
    }
  });

  it('keeps no retired brand artwork in the tree', () => {
    for (const asset of [
      'assets/images/logo@2x.png',
      'assets/images/splash.png',
      'assets/images/splashold.png',
      // The Icon Composer document for the retired blue-square icon; nothing
      // referenced it, app.config.ts points at the flat artwork instead.
      'assets/icons/appicon.icon/icon.json',
    ])
      expect(fs.existsSync(path.resolve(__dirname, '../..', asset))).toBe(
        false
      );
  });
});
