/** Where a shared profile lives: `https://fit.qla.dev/<username>`. */
export const PROFILE_LINK_BASE = 'https://fit.qla.dev';

/** What "Share app" hands the share sheet until the app has store listings. */
export const APP_LINK = PROFILE_LINK_BASE;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * A username as it is stored and linked: trimmed, lower case, no leading @.
 * Case is folded because a link is read aloud and typed back in, and
 * `Camil` and `camil` must not be two different people.
 */
export const normalizeUsername = (input: string): string =>
  input.trim().replace(/^@+/, '').toLowerCase();

/**
 * Letters, digits, dot, underscore and hyphen, starting with a letter or digit
 * — what survives in a URL path without escaping and still reads as a name.
 */
export const isValidUsername = (username: string): boolean =>
  username.length >= USERNAME_MIN_LENGTH &&
  username.length <= USERNAME_MAX_LENGTH &&
  /^[a-z0-9][a-z0-9._-]*$/.test(username);

export const profileLink = (username: string): string =>
  `${PROFILE_LINK_BASE}/${username}`;

/** The link without its scheme, for showing rather than sharing. */
export const profileLinkLabel = (username: string): string =>
  profileLink(username).replace(/^https:\/\//, '');
