import { Host, Picker, Text } from '@expo/ui/swift-ui';
import {
  controlSize,
  foregroundStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useCSSVariable } from 'uniwind';
import {
  SEGMENTED_CONTROL_HEIGHT,
  type Segment,
  type SegmentedControlSize,
} from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

/**
 * The native picker owns the thumb, its deformation, and its drag gesture.
 *
 * It is deliberately bare: it draws its own material, so a `LiquidGlassSurface`
 * behind it only stacked a second sheet of glass under the one the control
 * already draws, and the padding that wrapper added left the picker's own glass
 * squeezed inside a pill it did not fill. Nothing wraps it and nothing frames
 * it beyond the height below.
 *
 * That height is given rather than measured. `Host` used to size itself to its
 * content vertically, and a self-sizing host reports its height back to React
 * Native a frame or two after mount — so everything under it rendered at the
 * wrong offset first and dropped into place once the measurement arrived. On
 * the Goals tab this control is the first thing in the scroll view, so the
 * whole page visibly shifted on every first open. A fixed frame has nothing
 * left to report.
 */
export default function SegmentedControl<T extends string>({
  segments,
  activeKey,
  onSelect,
  label,
  size = 'regular',
}: {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  label?: string;
  size?: SegmentedControlSize;
}) {
  const [textPrimary, textMuted] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
  ]) as string[];

  return (
    <Host style={{ height: SEGMENTED_CONTROL_HEIGHT[size] }}>
      <Picker<T>
        label={label ?? 'Options'}
        selection={activeKey}
        onSelectionChange={onSelect}
        modifiers={[
          pickerStyle('segmented'),
          controlSize(size === 'compact' ? 'mini' : 'small'),
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
  );
}
