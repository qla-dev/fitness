import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import SafeImage from './SafeImage';
import type { GetImageSource } from '../hooks/useExerciseImageSource';
import type { Exercise } from '../types/exercise';
import type { ProgramExercise } from '../types/exerciseProgram';

interface Props {
  exercise: ProgramExercise;
  scrollOffset: number;
  lookup: (name: string) => Promise<Exercise | null>;
  getImageSource: GetImageSource;
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  color: string;
}

export default function ProgramExerciseRow({
  exercise,
  scrollOffset,
  lookup,
  getImageSource,
  onPress,
  disabled,
  busy,
  color,
}: Props) {
  const { t } = useTranslation();
  const row = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const checkVisibility = () => {
    row.current?.measureInWindow((_x, y, _width, height) => {
      if (height > 0 && y < windowHeight && y + height > 0) setVisible(true);
    });
  };

  useEffect(() => {
    if (!visible) {
      row.current?.measureInWindow((_x, y, _width, height) => {
        if (height > 0 && y < windowHeight && y + height > 0) setVisible(true);
      });
    }
  }, [scrollOffset, visible, windowHeight]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    lookup(exercise.name)
      .then((match) => {
        if (!cancelled) setImage(match?.images?.[0] ?? null);
      })
      .catch(() => {
        /* Keep the placeholder when a lookup fails. */
      });
    return () => {
      cancelled = true;
    };
  }, [exercise.name, lookup, visible]);

  return (
    <View ref={row} onLayout={checkVisibility} collapsable={false}>
      <View className="h-px bg-border-subtle ms-[52px]" />
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={disabled}
        onPress={onPress}
        className="py-3 pr-2 flex-row items-center"
      >
        <View className="mr-3">
          <SafeImage
            source={image ? getImageSource(image) : null}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            fallback={
              <View className="w-10 h-10 rounded-lg bg-raised items-center justify-center">
                <Icon name="exercise-weights" size={22} color={color} />
              </View>
            }
          />
        </View>
        <View className="flex-1 mr-2">
          <Text
            className="text-base font-semibold text-text-primary"
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {t('programs.setsReps', {
              defaultValue: '{{sets}} × {{reps}}',
              sets: exercise.sets,
              reps: exercise.reps,
            })}
          </Text>
          {exercise.note ? (
            <Text className="text-xs text-text-secondary mt-1">
              {exercise.note}
            </Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Icon name="chevron-forward" size={14} color={color} />
        )}
      </TouchableOpacity>
    </View>
  );
}
