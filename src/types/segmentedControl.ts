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
