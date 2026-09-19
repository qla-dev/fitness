import { Host, Picker, Text } from '@expo/ui/swift-ui';
import {
  controlSize,
  foregroundStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useCSSVariable } from 'uniwind';
import type { Segment } from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

/**
 * The native picker owns the thumb, its deformation, and its drag gesture.
 *
 * It is deliberately bare: it draws its own material, so a `LiquidGlassSurface`
 * behind it only stacked a second sheet of glass under the one the control
 * already draws, and the padding that wrapper added left the picker's own glass
 * squeezed inside a pill it did not fill. Nothing wraps it and nothing frames
 * it — the control keeps its intrinsic height and `Host` matches it.
 */
export default function SegmentedControl<T extends string>({
  segments,
  activeKey,
  onSelect,
  label,
}: {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  label?: string;
}) {
  const [textPrimary, textMuted] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
  ]) as string[];

  return (
    <Host matchContents={{ vertical: true }}>
      <Picker<T>
        label={label ?? 'Options'}
        selection={activeKey}
        onSelectionChange={onSelect}
        modifiers={[pickerStyle('segmented'), controlSize('large')]}
      >
        {segments.map((segment) => (
          <Text
            key={segment.key}
            modifiers={[
              tag(segment.key),
              foregroundStyle(
                segment.key === activeKey ? textPrimary : textMuted
              ),
            ]}
          >
            {segment.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
