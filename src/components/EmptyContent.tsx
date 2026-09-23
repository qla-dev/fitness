import React, { type ReactNode } from 'react';
import { View } from 'react-native';

interface EmptyContentProps {
  children: ReactNode;
  /**
   * Room to leave at the bottom, for a screen with something pinned there (a
   * tab bar, a sticky footer). The fill runs to the edge without it, because
   * an absolutely positioned view cannot see what it would land behind.
   */
  bottomOffset?: number;
  /** Appended to the container's classes, e.g. to change the gutter. */
  className?: string;
  testID?: string;
}

/**
 * Centres its content in the screen, whatever is above it.
 *
 * It fills its parent rather than taking a share of it: absolutely positioned
 * to all four edges, so on a screen whose root is the usual `flex-1` container
 * it spans from under the header to the bottom edge, and its content lands in
 * the middle of that — the middle of the screen, not the middle of whatever
 * was left over.
 *
 * That distinction is the whole reason this is a component. Stretching in flow
 * looks right until the controls above it grow: the leftover space starts
 * lower, so its centre drops, and an empty state under a couple of rows of
 * chrome ends up nearer the bottom of the screen than the middle of it — which
 * reads as content that failed to load rather than as an answer to "there is
 * nothing here yet".
 *
 * Filling instead of measuring is also what keeps it still. Working out where
 * the remainder starts means a layout pass, so the first frame is drawn at the
 * wrong offset and the content visibly drops into place; there is nothing to
 * measure here, so the first frame is the final one.
 *
 * It takes no space in the flex flow and passes touches through
 * (`pointerEvents="box-none"`), so it never sits on top of the controls it
 * shares a screen with. The parent must be a positioned container — React
 * Native views are `relative` by default, so a plain screen root already is.
 *
 * Related: `StatusView` is the filled-in version of this — icon, title,
 * subtitle and an action, already laid out — but it stretches in flow. Reach
 * for that one inside a section, and for this one to answer a whole screen.
 */
const EmptyContent: React.FC<EmptyContentProps> = ({
  children,
  bottomOffset = 0,
  className,
  testID,
}) => (
  <View
    testID={testID}
    pointerEvents="box-none"
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: bottomOffset,
    }}
    className={`items-center justify-center px-6 ${className ?? ''}`}
  >
    {children}
  </View>
);

export default EmptyContent;
