import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { StackActions, useNavigation } from '@react-navigation/native';
import PromptScreen, { type PromptScreenProps } from './PromptScreen';
import { navigationRef } from '../ActiveWorkoutBar';

/**
 * Every sheet in the app, presented the one way: the `Sheet` modal route,
 * which is GoalEdit's presentation — the native header with its native close
 * button, the system's modal corner, and the shared footer — drawn by
 * {@link PromptScreen}. There is no other sheet component; CustomModal,
 * NativePromptSheet, BottomSheetPicker, ActionSheet and TimeSheet are this
 * underneath. The calendar is the one exception.
 *
 * A screen renders `<PromptSheet open onClose …>` where it used to render a
 * bottom sheet. While open, every render publishes its props and children to
 * the route, so the sheet stays live: state the screen changes shows in the
 * sheet at once. Closing it from the route (the close button, a swipe down,
 * Android Back) calls `onClose`; setting `open` to false closes the route.
 *
 * One sheet at a time, as before: opening another while one is showing
 * replaces its content in place.
 */

type SheetSpec = Omit<PromptScreenProps, 'children' | 'onDismiss'> & {
  children: ReactNode;
  onClose: () => void;
};

const useSheetHost = create<{ spec: SheetSpec | null; owner: number | null }>(
  () => ({ spec: null, owner: null })
);

export const SHEET_ROUTE = 'Sheet' as const;

let nextOwner = 1;

const sheetRouteShowing = () =>
  navigationRef.isReady() &&
  navigationRef.getCurrentRoute()?.name === SHEET_ROUTE;

/** Closes the route if this owner's sheet is the one showing. */
function closeFor(owner: number) {
  if (useSheetHost.getState().owner !== owner) return;
  useSheetHost.setState({ owner: null });
  if (sheetRouteShowing()) navigationRef.dispatch(StackActions.pop());
}

/**
 * Closes the sheet that is showing, now rather than on the next render. For an
 * action that closes its sheet and then navigates: the close has to reach the
 * navigator first, or it would pop the screen just opened instead. The owner
 * still sets its own `open` to false; it is not told through `onClose`.
 */
export function dismissPromptSheet() {
  const { owner } = useSheetHost.getState();
  if (owner !== null) closeFor(owner);
}

export type PromptSheetProps = SheetSpec & { open: boolean };

export default function PromptSheet({ open, ...spec }: PromptSheetProps) {
  // Which PromptSheet this is, fixed for its lifetime.
  const [owner] = useState(() => nextOwner++);

  // Every render while open: the route always shows this render's content.
  useLayoutEffect(() => {
    if (open) useSheetHost.setState({ spec, owner });
  });

  useEffect(() => {
    if (!open) {
      closeFor(owner);
      return;
    }
    if (!sheetRouteShowing() && navigationRef.isReady())
      navigationRef.navigate(SHEET_ROUTE);
  }, [open, owner]);

  // Unmounted while open (its screen went away): take the sheet with it.
  useEffect(() => () => closeFor(owner), [owner]);

  return null;
}

/** The `Sheet` route: whatever PromptSheet is open, in a PromptScreen. */
export function PromptSheetScreen() {
  const navigation = useNavigation();
  const spec = useSheetHost((state) => state.spec);

  // However the route goes — close button, swipe, Back, or the owner closing
  // it — the owner hears about it once, and the slot is cleared.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const current = useSheetHost.getState();
        useSheetHost.setState({ spec: null, owner: null });
        if (current.owner !== null) current.spec?.onClose();
      }),
    [navigation]
  );

  if (!spec) return null;
  const { children, onClose: _onClose, ...props } = spec;
  return <PromptScreen {...props}>{children}</PromptScreen>;
}
