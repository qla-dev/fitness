import { Host, Picker, Text } from '@expo/ui/swift-ui';
import {
  controlSize,
  foregroundStyle,
  frame,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useCSSVariable } from 'uniwind';

import type { Segment } from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

/** The system control's own height at `controlSize('large')`. */
const CONTROL_HEIGHT = 44;

/**
 * Stands in when a caller names no label. Never drawn, but the native side
 * needs a non-empty one to build the picker at all, so it must not be ''.
 */
const FALLBACK_LABEL = 'Options';

/**
 * The app's segmented control on iOS: the system's own, not a copy of it.
 *
 * SwiftUI's segmented `Picker` is what the Health app's range selector is, so
 * this inherits the whole behaviour rather than approximating it — the
 * selection can be **dragged** across the segments, and press-and-hold expands
 * the thumb the way Liquid Glass does, because the system draws and drives it.
 *
 * That is why this exists. A hand-rolled pill can be animated to slide when
 * tapped, but it only moves once a press has landed somewhere; the system
 * control tracks your finger continuously, and no amount of gesture work
 * reproduces the feel of it.
 *
 * Android keeps the React Native implementation in `SegmentedControl.tsx`,
 * which this file shadows. Both take the same props, so callers never choose.
 */
const SegmentedControl = <T extends string>({
  segments,
  activeKey,
  onSelect,
  label,
}: {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  label?: string;
}) => {
  // The native control tints its own thumb; the labels are ours to colour, so
  // they follow the theme rather than the system accent.
  const [textPrimary, textMuted] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
  ]) as string[];

  return (
    <Host matchContents={{ vertical: true }}>
      <Picker<T>
        // Required, even though a segmented picker never draws it — SwiftUI
        // shows a picker's label only in a Form. `PickerView.swift` builds the
        // Picker from a @ViewBuilder whose branches all need a label, a
        // systemImage or a label slot, and has no else: without one of them it
        // silently builds nothing at all, which is why the control had no
        // gestures to give. VoiceOver reads it, so it is worth writing.
        label={label ?? FALLBACK_LABEL}
        selection={activeKey}
        onSelectionChange={onSelect}
        modifiers={[
          pickerStyle('segmented'),
          // Both of these are load-bearing rather than decoration, and leaving
          // them off is what made this look broken: with no explicit frame the
          // hosted control lays out against a proposed size of nothing and
          // collapses to a strip. A tap still lands, because that only needs a
          // point — but there is no room to drag along or to press and hold,
          // so the control reads as one that has simply lost its gestures.
          controlSize('large'),
          frame({ height: CONTROL_HEIGHT }),
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
};

export default SegmentedControl;
