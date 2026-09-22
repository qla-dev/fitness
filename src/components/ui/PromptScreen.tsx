import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import FooterCTA from './FooterCTA';
import {
  HEADER_CONTENT_GAP,
  useNativeHeaderOffset,
  useScreenHeader,
} from '../../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../../services/nativeTabBarPreference';

/**
 * The app's one-decision screen: a title, a line of explanation, one control,
 * and the action that commits it.
 *
 * Presented as a modal route, not a bottom sheet. That is the whole point of
 * it: the header comes from `useScreenHeader`, so on iOS its close button is a
 * real native header item — the system's own material and press animation —
 * and the sheet's corner radius is the one iOS gives a modal. Drawn inside a
 * `BottomSheetModal` the same header can only be imitated, since there is no
 * native header there to put items into.
 *
 * `hasTextInput` decides alignment, because typing and tapping want opposite
 * layouts: with a field the control sits against the explanation and leaves
 * the lower half to the keyboard; without one it is centred in the room
 * between the title and the action.
 */
export default function PromptScreen({
  headerTitle,
  title,
  description,
  footnote,
  footerLabel,
  onFooterPress,
  footerDisabled,
  footerLoading,
  hasTextInput = false,
  children,
}: {
  /**
   * What kind of thing is being set, in the navigator's own bar — "Goals" over
   * Protein. The heading below says which one.
   */
  headerTitle: string;
  /** The heading: the one thing this screen changes. */
  title: string;
  /** The line under the title explaining what the choice affects. */
  description?: string;
  /** Small print above the action — a caveat, not an instruction. */
  footnote?: string;
  footerLabel: ReactNode;
  onFooterPress: () => void;
  footerDisabled?: boolean;
  footerLoading?: boolean;
  /** See the note above: it decides alignment. */
  hasTextInput?: boolean;
  children: React.ReactNode;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();

  const header = useScreenHeader({
    variant: 'transparent',
    title: headerTitle,
    left: { kind: 'dismiss', onPress: () => navigation.goBack() },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {/* The transparent bar floats over the content, and there is no scroll
          view here to take the inset automatically, so the first line clears
          it by the bar's measured height — otherwise the title starts under
          the close button. */}
      <View
        className="px-5"
        style={{
          paddingTop: usesNativeHeader ? headerOffset + HEADER_CONTENT_GAP : 8,
        }}
      >
        <Text className="text-text-primary text-3xl font-bold">{title}</Text>
        {description ? (
          <Text className="text-text-secondary text-base mt-2">
            {description}
          </Text>
        ) : null}
      </View>

      <View
        className={`flex-1 px-5 ${hasTextInput ? 'pt-6' : 'justify-center'}`}
      >
        {children}
      </View>

      {footnote ? (
        <Text className="text-text-muted text-xs px-5 pb-3">{footnote}</Text>
      ) : null}
      <FooterCTA
        glass
        label={footerLabel}
        onPress={onFooterPress}
        disabled={footerDisabled}
        loading={footerLoading}
      />
    </View>
  );
}
