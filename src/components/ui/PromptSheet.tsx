import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import {
  CommonActions,
  StackActions,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import PromptScreen, { type PromptScreenProps } from './PromptScreen';
import { navigationRef } from '../ActiveWorkoutBar';
import { NoNativeHeaderContext } from '../../services/nativeTabBarPreference';
import type { RootStackParamList } from '../../types/navigation';

/**
 * Every sheet in the app, presented the one way: a `Sheet` modal route, which
 * is GoalEdit's presentation — the native header with its native close
 * button, the system's modal corner, and the shared footer — drawn by
 * {@link PromptScreen}. There is no other sheet component; CustomModal,
 * NativePromptSheet, BottomSheetPicker, ActionSheet and TimeSheet are this
 * underneath. The calendars are the one exception.
 *
 * A screen renders `<PromptSheet open onClose …>` where it used to render a
 * bottom sheet. While open, every render publishes its props and children to
 * its route, so the sheet stays live: state the screen changes shows in the
 * sheet at once. Closing it from the route (the close button, a swipe down,
 * Android Back) calls `onClose`; setting `open` to false closes the route.
 *
 * Each open sheet is its own route, so a sheet opened from inside another
 * (a fast's history, then one fast to edit) stacks on top of it, and closing
 * the inner one goes back to the outer.
 */

type SheetSpec = Omit<PromptScreenProps, 'children' | 'onDismiss'> & {
  children: ReactNode;
  onClose: () => void;
  /**
   * Opens at part height, with the rest a drag up — Hideya's power-ups
   * sheet. On iOS that is a detent form sheet, which has no native header,
   * so the sheet draws its own bar; Android has no detents and opens it full.
   */
  expandable?: boolean;
};

const useSheetHost = create<{ specs: Record<number, SheetSpec> }>(() => ({
  specs: {},
}));

export const SHEET_ROUTE = 'Sheet' as const;
export const DETENT_SHEET_ROUTE = 'DetentSheet' as const;
const isSheetRoute = (name?: string) =>
  name === SHEET_ROUTE || name === DETENT_SHEET_ROUTE;

let nextOwner = 1;
/** Sheets their owner is closing, so the route does not report it back. */
const closing = new Set<number>();

type SheetRoute = { key: string; name: string; params?: { owner?: number } };

const sheetRoutes = (): SheetRoute[] =>
  navigationRef.isReady()
    ? ((navigationRef.getRootState()?.routes ?? []) as SheetRoute[]).filter(
        (route) => isSheetRoute(route.name)
      )
    : [];

const routeFor = (owner: number) =>
  sheetRoutes().find((route) => route.params?.owner === owner);

/** Closes this owner's sheet route, if it is showing. */
function closeFor(owner: number) {
  const route = routeFor(owner);
  if (!route) return;
  closing.add(owner);
  if (navigationRef.getCurrentRoute()?.key === route.key) {
    navigationRef.dispatch(StackActions.pop());
    return;
  }
  // Under another sheet: take it out of the stack without moving the top.
  navigationRef.dispatch((state) => {
    const routes = state.routes.filter((item) => item.key !== route.key);
    return CommonActions.reset({
      ...state,
      routes,
      index: routes.length - 1,
    });
  });
}

/**
 * Closes the sheet on top, now rather than on the next render. For an action
 * that closes its sheet and then navigates: the close has to reach the
 * navigator first, or it would pop the screen just opened instead. The owner
 * still sets its own `open` to false; it is not told through `onClose`.
 */
export function dismissPromptSheet() {
  const current = navigationRef.isReady()
    ? (navigationRef.getCurrentRoute() as SheetRoute | undefined)
    : undefined;
  const owner = isSheetRoute(current?.name) ? current?.params?.owner : null;
  if (typeof owner === 'number') closeFor(owner);
}

export type PromptSheetProps = SheetSpec & { open: boolean };

export default function PromptSheet({ open, ...spec }: PromptSheetProps) {
  // Which PromptSheet this is, fixed for its lifetime.
  const [owner] = useState(() => nextOwner++);

  // Every render while open: the route always shows this render's content.
  useLayoutEffect(() => {
    if (open)
      useSheetHost.setState((state) => ({
        specs: { ...state.specs, [owner]: spec },
      }));
  });

  useEffect(() => {
    if (!open) {
      closeFor(owner);
      return;
    }
    if (!routeFor(owner) && navigationRef.isReady()) {
      closing.delete(owner);
      navigationRef.dispatch(
        StackActions.push(spec.expandable ? DETENT_SHEET_ROUTE : SHEET_ROUTE, {
          owner,
        })
      );
    }
    // Which route is read once, at opening; the sheet keeps it while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner]);

  // Unmounted while open (its screen went away): take the sheet with it.
  useEffect(() => () => closeFor(owner), [owner]);

  return null;
}

/** A `Sheet` route: its owner's PromptSheet, in a PromptScreen. */
export function PromptSheetScreen() {
  const navigation = useNavigation();
  // Read once: the route's params do not change, and a route on its way out
  // can render once more after it has left the stack.
  const route =
    useRoute<
      RouteProp<
        RootStackParamList,
        typeof SHEET_ROUTE | typeof DETENT_SHEET_ROUTE
      >
    >();
  const [owner] = useState(() => route?.params?.owner ?? -1);
  const spec = useSheetHost((state) => state.specs[owner]);

  // However the route goes — close button, swipe, Back, or the owner closing
  // it — its content is dropped, and the owner hears about it unless it was
  // the one closing.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const current = useSheetHost.getState().specs[owner];
        useSheetHost.setState((state) => {
          const specs = { ...state.specs };
          delete specs[owner];
          return { specs };
        });
        if (closing.delete(owner)) return;
        current?.onClose();
      }),
    [navigation, owner]
  );

  if (!spec) return null;
  const {
    children,
    onClose: _onClose,
    expandable: _expandable,
    ...props
  } = spec;
  const content = <PromptScreen {...props}>{children}</PromptScreen>;
  return route?.name === DETENT_SHEET_ROUTE ? (
    <NoNativeHeaderContext.Provider value={true}>
      {content}
    </NoNativeHeaderContext.Provider>
  ) : (
    content
  );
}
