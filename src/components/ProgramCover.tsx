import { View } from 'react-native';
import Icon from './Icon';
import SafeImage from './SafeImage';
import { useProgramThumbnails } from '../hooks';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import type { ExerciseProgram } from '../types/exerciseProgram';

/**
 * A store program's cover: the first exercise in it that has artwork, the way
 * a saved workout program takes its thumbnail from its first illustrated
 * exercise. Falls back to the accent tile and icon while the lookup is out, or
 * for a program whose movements have no pictures at all — same footprint
 * either way, so nothing reflows when the image lands.
 */
export default function ProgramCover({
  program,
  size,
  iconSize,
  accent,
  radius = 16,
}: {
  program: ExerciseProgram;
  size: number;
  iconSize: number;
  accent: string;
  radius?: number;
}) {
  // One program, but the same query key the store fills, so a cover already
  // resolved on the shelf is reused here rather than fetched a second time.
  const covers = useProgramThumbnails([program]);
  const { getImageSource } = useExerciseImageSource();

  const cover = covers[program.id];
  const source = cover ? getImageSource(cover) : null;
  const placeholder = (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: accent,
      }}
    >
      <Icon name={program.icon} size={iconSize} color="#FFFFFF" />
    </View>
  );

  if (!source) return placeholder;
  return (
    <SafeImage
      source={source}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      fallback={placeholder}
    />
  );
}
