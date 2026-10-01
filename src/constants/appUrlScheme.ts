/**
 * The app's deep-link URL scheme, as declared by `scheme` in app.json. It keeps
 * its pre-rebrand spelling on purpose: installed home-screen widgets, running
 * Live Activities and OAuth callbacks open the app through it, so renaming it
 * would break every link an existing install already holds.
 */
export const APP_URL_SCHEME = 'sparkyfitnessmobile';

/** The scheme's root URL, e.g. `${APP_URL}search`. */
export const APP_URL = `${APP_URL_SCHEME}://`;
