import React from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * A stand-in for PromptSheet in component tests: the sheet's route is out of
 * scope, so while `open` it renders what the route would show — the title,
 * the description, the content and the footer action — in place.
 *
 *   jest.mock('…/components/ui/PromptSheet', () =>
 *     require('…/helpers/promptSheetMock')
 *   );
 *
 * `mockSheetClosed` records closes, the way a bottom sheet's dismiss was
 * recorded before.
 */
export const mockSheetClosed = jest.fn();

export const dismissPromptSheet = jest.fn();

export default function PromptSheetMock({
  open,
  title,
  description,
  footerLabel,
  onFooterPress,
  footerDisabled,
  children,
}: {
  open: boolean;
  title?: string;
  description?: string;
  footerLabel?: React.ReactNode;
  onFooterPress?: () => void;
  footerDisabled?: boolean;
  children?: React.ReactNode;
}) {
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (wasOpen.current && !open) mockSheetClosed();
    wasOpen.current = open;
  }, [open]);
  if (!open) return null;
  return (
    <View testID="prompt-sheet">
      {title ? <Text>{title}</Text> : null}
      {description ? <Text>{description}</Text> : null}
      {children}
      {footerLabel !== undefined && onFooterPress ? (
        <Pressable
          testID="prompt-sheet-footer"
          accessibilityLabel={
            typeof footerLabel === 'string' ? footerLabel : undefined
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: !!footerDisabled }}
          disabled={footerDisabled}
          onPress={onFooterPress}
        >
          <Text>{footerLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
