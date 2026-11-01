import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireSelectionHaptic } from '../services/haptics';
import type {
  SetupSuggestion,
  SetupSuggester,
} from '../services/setupWizardSession';

const DEBOUNCE_MS = 250;

/**
 * Matches for a text field as it is typed, under the input. A pick hands its
 * answers back and the list stays hidden until the text changes again, so
 * the field reads as filled rather than as still searching.
 */
export default function FieldSuggestions({
  query,
  suggest,
  source,
  onPick,
}: {
  query: string;
  suggest: SetupSuggester;
  /** Where the matches come from, in a line under them. */
  source?: string;
  onPick: (suggestion: SetupSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<SetupSuggestion[]>([]);
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const terms = query.trim();
    if (terms.length < 2 || terms === picked.current) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggest(terms, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setSuggestions(next);
        })
        // Offline or slow: no list, and typing still works.
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, suggest]);

  if (!suggestions.length) return null;
  return (
    <View className="mt-2 mb-2">
      <View className="bg-surface rounded-2xl overflow-hidden">
        {suggestions.map((suggestion, index) => (
          <Pressable
            key={`${suggestion.label}-${index}`}
            accessibilityRole="button"
            onPress={() => {
              fireSelectionHaptic();
              picked.current = suggestion.value;
              setSuggestions([]);
              onPick(suggestion);
            }}
            className={`px-4 py-3 ${index > 0 ? 'border-t border-border-subtle' : ''}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-text-primary text-base" numberOfLines={1}>
              {suggestion.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {source ? (
        <Text className="text-text-muted text-xs mt-1.5 px-1">{source}</Text>
      ) : null}
    </View>
  );
}
