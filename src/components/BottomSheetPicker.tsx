import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import PromptSheet, { dismissPromptSheet } from './ui/PromptSheet';
import {
  INPUT_FILL_CLASS,
  INPUT_FONT_SIZE,
  INPUT_HEIGHT,
  INPUT_PADDING_LEFT,
  INPUT_RADIUS,
} from './ui/inputStyle';

export interface PickerOption<T> {
  label: string;
  value: T;
}

interface PickerTriggerProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The dropdown-style control BottomSheetPicker renders when no custom trigger
 * is supplied. Exported so settings rows backed by a different sheet (e.g.
 * RestPeriodSheet) present the same control.
 */
export function PickerTrigger({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint = undefined,
  containerStyle,
}: PickerTriggerProps) {
  const { t } = useTranslation();
  const [textMuted] = useCSSVariable(['--color-text-muted']) as [string];
  return (
    <TouchableOpacity
      // The shared field look (see inputStyle), so a picker lines up with the
      // FormInput beside it.
      className={`${INPUT_FILL_CLASS} flex-row items-center justify-between`}
      style={[
        {
          minHeight: INPUT_HEIGHT,
          borderRadius: INPUT_RADIUS,
          paddingLeft: INPUT_PADDING_LEFT,
          paddingRight: 16,
        },
        containerStyle,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        accessibilityHint ??
        t('common.openSelectionMenu', { defaultValue: 'Opens selection menu' })
      }
    >
      <Text
        className="flex-1 text-text-primary"
        style={{ fontSize: INPUT_FONT_SIZE }}
      >
        {label}
      </Text>
      <Icon name="chevron-down" size={16} color={textMuted} />
    </TouchableOpacity>
  );
}

export interface PickerSection<T> {
  title?: string;
  options: PickerOption<T>[];
}

interface BottomSheetPickerProps<T extends string | number> {
  value: T;
  options?: PickerOption<T>[];
  sections?: PickerSection<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  title?: string;
  accessibilityHint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  renderTrigger?: (props: {
    onPress: () => void;
    selectedOption: PickerOption<T> | undefined;
  }) => React.ReactNode;
}

function BottomSheetPicker<T extends string | number>({
  value,
  options,
  sections,
  onSelect,
  placeholder = '',
  title,
  accessibilityHint,
  containerStyle,
  renderTrigger,
}: BottomSheetPickerProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const primary = useCSSVariable('--color-accent-primary') as string;

  const normalizedSections = useMemo<PickerSection<T>[]>(() => {
    if (sections && sections.length > 0) {
      return sections;
    }
    return [{ options: options ?? [] }];
  }, [options, sections]);

  const flatOptions = useMemo(
    () => normalizedSections.flatMap((section) => section.options),
    [normalizedSections]
  );

  const selectedOption = flatOptions.find((opt) => opt.value === value);
  const displayText =
    selectedOption?.label ||
    placeholder ||
    t('common.selectOption', { defaultValue: 'Select an option' });

  // A pick commits and closes: the list is the whole decision, so the sheet
  // has no footer action.
  const handleSelect = useCallback(
    (item: PickerOption<T>) => {
      dismissPromptSheet();
      setOpen(false);
      onSelect(item.value);
    },
    [onSelect]
  );

  const handleOpen = useCallback(() => setOpen(true), []);

  const renderOption = (item: PickerOption<T>, isLast: boolean) => {
    const isSelected = item.value === value;
    return (
      <TouchableOpacity
        key={String(item.value)}
        className={`flex-row items-center justify-between px-4 py-3.5 ${
          isLast ? '' : 'border-b border-border-subtle'
        }`}
        style={
          isLast ? undefined : { borderBottomWidth: StyleSheet.hairlineWidth }
        }
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: isSelected }}
        accessibilityHint={t('common.selectOptionHint', {
          defaultValue: 'Double tap to select this option',
        })}
      >
        <Text
          className={`text-base text-text-primary ${isSelected ? 'font-semibold' : ''}`}
        >
          {item.label}
        </Text>
        {isSelected && <Icon name="checkmark" size={20} color={primary} />}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (section: PickerSection<T>, index: number) => {
    if (!section.title) return null;

    return (
      <View
        key={`section-${section.title}-${index}`}
        className="px-4 pt-4 pb-2"
      >
        <Text className="text-xs font-semibold uppercase text-text-muted">
          {section.title}
        </Text>
      </View>
    );
  };

  const renderSections = () =>
    normalizedSections.map((section, index) => (
      <React.Fragment key={`section-${section.title ?? 'default'}-${index}`}>
        {renderSectionHeader(section, index)}
        {/* Only the very last option drops its divider: within the list a
            divider still separates a section's last option from the next
            section's header. */}
        {section.options.map((option, optionIndex) =>
          renderOption(
            option,
            index === normalizedSections.length - 1 &&
              optionIndex === section.options.length - 1
          )
        )}
      </React.Fragment>
    ));

  return (
    <>
      {renderTrigger ? (
        // renderTrigger is a render prop; invoking it during render is intended.
        renderTrigger({ onPress: handleOpen, selectedOption })
      ) : (
        <PickerTrigger
          label={displayText}
          onPress={handleOpen}
          accessibilityLabel={title || placeholder}
          accessibilityHint={accessibilityHint}
          containerStyle={containerStyle}
        />
      )}

      <PromptSheet
        open={open}
        onClose={() => setOpen(false)}
        headerTitle=""
        title={
          title ||
          placeholder ||
          t('common.selectOption', { defaultValue: 'Select an option' })
        }
        topAligned
      >
        <View className="bg-surface rounded-2xl overflow-hidden">
          {renderSections()}
        </View>
      </PromptSheet>
    </>
  );
}

export default BottomSheetPicker;
