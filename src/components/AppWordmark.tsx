import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { useCSSVariable } from 'uniwind';

/**
 * The app's name, set the one way it is allowed to be set: the brand face,
 * with `.fit` in the accent color. Every surface that prints the name uses
 * this rather than styling a raw string, so the mark cannot drift.
 *
 * It renders as a nested `<Text>`, so it can sit inline inside a sentence and
 * inherit that sentence's size — only the family and the accent are its own.
 * That is what keeps surrounding copy (e.g. "Log data into") in the normal UI
 * face while the name itself stays branded.
 *
 * The brand face is loaded here and the mark falls back to the inherited face
 * until it arrives, so the name is never missing while the font loads.
 */
export const APP_NAME_STEM = 'qla';
export const APP_NAME_SUFFIX = '.fit';

const AppWordmark: React.FC<{ style?: StyleProp<TextStyle> }> = ({ style }) => {
  const [brandFontLoaded] = useFonts({
    FacebookSansBold: require('../../assets/fonts/FacebookSansBold.ttf'),
  });
  const accent = useCSSVariable('--color-accent-primary') as string;

  // `fontWeight: 'normal'` because the face is already bold: leaving the
  // inherited weight on would ask the system to synthesize a second bold.
  const brandFace: StyleProp<TextStyle> = brandFontLoaded
    ? { fontFamily: 'FacebookSansBold', fontWeight: 'normal' }
    : undefined;

  return (
    <Text style={[brandFace, style]}>
      {APP_NAME_STEM}
      <Text style={{ color: accent }}>{APP_NAME_SUFFIX}</Text>
    </Text>
  );
};

export default AppWordmark;
