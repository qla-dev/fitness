import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { BackHandler, Platform } from 'react-native';
import {
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';

/**
 * `@gorhom/bottom-sheet`'s modal does not consume the Android hardware Back
 * button. With a sheet open, Back fell through to React Navigation: the first
 * press switched the tab underneath the still-visible sheet and the second one
 * left the app. Every sheet in the app imports this wrapper instead, which
 * registers a `BackHandler` listener only while the sheet is presented and
 * dismisses the sheet on press. The listener is registered on open — after the
 * navigators' — so it runs first and wins.
 *
 * The type export keeps `useRef<BottomSheetModal>(null)` and the `present()` /
 * `dismiss()` surface identical to gorhom's class; only the import path changes.
 */
export type BottomSheetModal = GorhomBottomSheetModal;

// The type and the component deliberately share a name so callers keep
// gorhom's `useRef<BottomSheetModal>` + `<BottomSheetModal>` pairing intact.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const BottomSheetModal = forwardRef<
  GorhomBottomSheetModal,
  BottomSheetModalProps
>(function BottomSheetModal({ onChange, ...props }, ref) {
  const inner = useRef<GorhomBottomSheetModal>(null);
  const [open, setOpen] = useState(false);

  // Child refs are attached before this runs, so the instance is available.
  useImperativeHandle(ref, () => inner.current as GorhomBottomSheetModal, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !open) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        inner.current?.dismiss();
        return true;
      }
    );
    return () => subscription.remove();
  }, [open]);

  const handleChange = useCallback<NonNullable<BottomSheetModalProps['onChange']>>(
    (index, position, type) => {
      setOpen(index >= 0);
      onChange?.(index, position, type);
    },
    [onChange]
  );

  return <GorhomBottomSheetModal ref={inner} {...props} onChange={handleChange} />;
});
