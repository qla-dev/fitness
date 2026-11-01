/**
 * The one text-field look, shared by PillInput and FormInput: a borderless
 * rounded pill on the raised fill. Raised rather than surface because a field
 * sits both on the screen background and inside surface cards, and in the
 * true-black dark palette a surface pill on the background all but vanished.
 */
export const INPUT_FILL_CLASS = 'bg-raised';
export const INPUT_HEIGHT = 52;
export const INPUT_RADIUS = INPUT_HEIGHT / 2;
/** Multiline fields keep the rounding without turning into a capsule. */
export const INPUT_MULTILINE_RADIUS = 20;
export const INPUT_PADDING_LEFT = 18;
export const INPUT_FONT_SIZE = 17;
