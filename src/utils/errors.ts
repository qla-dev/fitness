/** Extracts a human-readable message from an unknown thrown value. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The part of an Expo native-module error that says what went wrong. Those
 * read "Calling the 'runAsync' function has failed → Caused by: <reason>",
 * and a one-line toast cut off before the reason; this returns the last
 * cause, or the message unchanged when there is none.
 */
export function nativeErrorCause(message: string): string {
  const parts = message.split(/Caused by:\s*/);
  const cause = parts[parts.length - 1]?.trim();
  return parts.length > 1 && cause ? cause : message;
}
