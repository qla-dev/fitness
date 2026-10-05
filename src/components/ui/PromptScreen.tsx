import React, { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';

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
export default function PromptScreen(props: PromptScreenProps) {
  // The provider ties a top-aligned page's scroll view to the footer, so iOS
  // 26 draws its scroll edge effect under the action the way the chat does
  // under its composer.
  return (
    <ScrollEdgeEffectProvider>
      <PromptScreenContent {...props} />
    </ScrollEdgeEffectProvider>
  );
}

type PromptScreenProps = {
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
  /** The action's fill, for a screen that is about one coloured thing. */
  footerTint?: string;
  dismissDisabled?: boolean;
  /** See the note above: it decides alignment. */
  hasTextInput?: boolean;
  /**
   * Starts the content under the explanation instead of centring it, for a
   * control that is a list (conversation history) and fills the room. The
   * whole page then scrolls as one, title included, the way the questionnaire
   * does — children must not bring a scroll view of their own.
   */
  topAligned?: boolean;
  children: React.ReactNode;
};

function PromptScreenContent({
  headerTitle,
  title,
  description,
  footnote,
  footerLabel,
  onFooterPress,
  footerDisabled,
  footerLoading,
  footerTint,
  dismissDisabled = false,
  hasTextInput = false,
  topAligned = false,
  children,
}: PromptScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const [footerHeight, setFooterHeight] = useState(0);
  const edgeEffectRef = useScrollEdgeEffectRef();
  // How far the page scrolls before the heading has gone under the bar, at
  // which point its title moves into the bar — the questionnaire-style page
  // has no large title for iOS to hand off, so the hook animates it in.
  const [headingBottom, setHeadingBottom] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const header = useScreenHeader({
    variant: 'transparent',
    title: headerTitle,
    left: {
      kind: 'dismiss',
      disabled: dismissDisabled,
      onPress: () => navigation.goBack(),
    },
    // iOS 26 draws its scroll-edge effect along the top of a screen's scroll
    // view. A top-aligned page scrolls from the top of the sheet like the
    // questionnaire, so the effect sits under the bar where it belongs. A
    // centred one may still hold a scroller below the title, where the effect
    // would land mid-sheet and smear it, so there the edge is clipped.
    //
    // The scrolled title goes in as a plain native `title`, not `nativeTitle`:
    // on the transparent variant that prop renders the title as a React view
    // to animate it, and a JS title view in place of the native one leaves
    // iOS drawing a much weaker edge effect behind it (see AddHubScreen).
    nativeOptions: topAligned
      ? { title: scrolled ? title : '' }
      : { scrollEdgeEffects: { top: 'hidden' } },
  });

  const heading = (
    <View
      className="px-5"
      onLayout={
        topAligned
          ? (event) =>
              setHeadingBottom(
                event.nativeEvent.layout.y + event.nativeEvent.layout.height
              )
          : undefined
      }
      style={
        topAligned
          ? undefined
          : {
              paddingTop: usesNativeHeader
                ? headerOffset + HEADER_CONTENT_GAP
                : 8,
            }
      }
    >
      <Text className="text-text-primary text-3xl font-bold">{title}</Text>
      {description ? (
        <Text className="text-text-secondary text-base mt-2">
          {description}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {topAligned ? (
        // One scroll view from the top of the sheet with the glass footer
        // floating over the end of the list. The inset under the native bar
        // is the automatic one, as on the Tracker: iOS sizes its edge effect
        // from that inset, so a bar height added as padding left the blur a
        // thin band at the sheet's top that had faded by the title row.
        <ScrollView
          ref={edgeEffectRef}
          className="flex-1"
          contentInsetAdjustmentBehavior={
            usesNativeHeader ? 'automatic' : 'never'
          }
          automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
          scrollEventThrottle={16}
          onScroll={(event) => {
            // The heading's bottom in content coordinates, against the bar's
            // bottom edge in the same space. With the automatic inset the
            // resting offset is -headerOffset, so the bar's edge sits at 0.
            const next =
              headingBottom > 0 &&
              event.nativeEvent.contentOffset.y + headerOffset >= headingBottom;
            if (next !== scrolled) setScrolled(next);
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: usesNativeHeader ? HEADER_CONTENT_GAP : 8,
            paddingBottom: footerHeight + 12,
          }}
        >
          {heading}
          <View className="flex-1 px-5 pt-6">{children}</View>
          {footnote ? (
            <Text className="text-text-muted text-xs px-5 pt-3">
              {footnote}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <>
          {/* No scroll view to take the inset here, so the heading pads
              itself clear of the transparent bar. */}
          {heading}
          <View
            className={`flex-1 px-5 ${hasTextInput ? 'pt-6' : 'justify-center'}`}
          >
            {children}
          </View>
          {footnote ? (
            <Text className="text-text-muted text-xs px-5 pb-3">
              {footnote}
            </Text>
          ) : null}
        </>
      )}
      <FooterCTA
        absolute={topAligned}
        edgeEffect={topAligned}
        onHeightChange={topAligned ? setFooterHeight : undefined}
        glass
        label={footerLabel}
        onPress={onFooterPress}
        disabled={footerDisabled}
        loading={footerLoading}
        tint={footerTint}
      />
    </View>
  );
}
