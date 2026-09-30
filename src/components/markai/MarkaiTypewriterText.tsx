import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

/**
 * A MarkAI reply typed out as it arrives: a flat reveal of `speed` ms per
 * character, no cursor, the same timing as Freightbook's Lena
 * (LenaTypewriterText). The chat's scroll view follows the growing text
 * through its content size, so nothing here scrolls. A tap on the text
 * finishes it at once.
 */
export default function MarkaiTypewriterText({
  text,
  speed = 6,
  style,
  onComplete,
}: {
  text: string;
  speed?: number;
  style?: StyleProp<TextStyle>;
  onComplete?: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= text.length) {
      const timeout = setTimeout(() => onComplete?.(), 100);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setShown((count) => count + 1), speed);
    return () => clearTimeout(timeout);
  }, [shown, onComplete, speed, text.length]);

  return (
    <Text
      style={style}
      className="text-text-primary"
      onPress={shown < text.length ? () => setShown(text.length) : undefined}
      accessibilityLabel={text}
    >
      {text.slice(0, shown)}
    </Text>
  );
}
