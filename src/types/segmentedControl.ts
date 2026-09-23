/**
 * One option in a segmented control.
 *
 * Kept out of the components so the iOS and Android implementations can both
 * name it without one importing the other: `./SegmentedControl` resolves to
 * the `.ios` file on iOS, so the native implementation asking its own module
 * for the type would be asking itself.
 */
export type Segment<T extends string> = {
  key: T;
  label: string;
};

/**
 * How tall the control draws.
 *
 * `compact` is for a control that sits inside content rather than heading a
 * screen — a range picker above a chart, where the chart is the subject and
 * the picker is a setting on it. `regular` is the default everywhere else.
 */
export type SegmentedControlSize = 'regular' | 'compact';

/**
 * The control's height per size, in points.
 *
 * Fixed rather than measured, and that is the point on iOS: the native
 * implementation hosts a SwiftUI picker, and a host that sizes itself to its
 * content reports that size back to React Native a frame or two AFTER mount.
 * Anything below it therefore renders at the wrong place first and drops into
 * position once the measurement lands — which on the Goals tab, where this
 * control is the first thing in the scroll view, shoved the whole page down on
 * every first open. Reserving the height up front means there is nothing left
 * to measure.
 */
export const SEGMENTED_CONTROL_HEIGHT: Record<SegmentedControlSize, number> = {
  regular: 36,
  compact: 30,
};
