import { Host, Picker, Text } from '@expo/ui/swift-ui';
import {
  controlSize,
  foregroundStyle,
  frame,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useCSSVariable } from 'uniwind';
import LiquidGlassSurface from './LiquidGlassSurface';
import type { Segment } from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

/** The native picker owns the thumb, its deformation, and its drag gesture. */
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
    <LiquidGlassSurface
      glassEffectStyle="regular"
      // The surrounding material must not compete with the picker's gestures.
      isInteractive={false}
      style={{ borderRadius: 999, padding: 4 }}
    >
      <Host matchContents={{ vertical: true }}>
        <Picker<T>
          label={label ?? 'Options'}
          selection={activeKey}
          onSelectionChange={onSelect}
          modifiers={[
            pickerStyle('segmented'),
            controlSize('large'),
            frame({ height: 48 }),
          ]}
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
    </LiquidGlassSurface>
  );
}
