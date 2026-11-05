import React, { createContext, useContext } from 'react';
import {
  Image,
  type ImageSourcePropType,
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import { fireSelectionHaptic } from '../services/haptics';
import MenuItemIcon from './MenuItemIcon';
import MenuItem, { MenuItemDivider } from './MenuItem';

const SettingsRowGroupContext = createContext<{ grouped: boolean }>({
  grouped: false,
});

interface SettingsRowGroupProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export const SettingsRowGroup: React.FC<SettingsRowGroupProps> = ({
  children,
  title,
  subtitle,
  style,
  className = '',
}) => {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <SettingsRowGroupContext.Provider value={{ grouped: true }}>
      <View className={`mb-4 ${className}`} style={style}>
        {title && (
          <View className="px-4 pb-2">
            <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {title}
            </Text>
            {typeof subtitle === 'string' ? (
              <Text className="text-xs text-text-secondary mt-0.5">
                {subtitle}
              </Text>
            ) : subtitle ? (
              <View className="mt-0.5">{subtitle}</View>
            ) : null}
          </View>
        )}
        <View className="bg-surface rounded-2xl overflow-hidden">
          {items.map((child, i) => (
            <React.Fragment key={i}>
              {child}
              {i < items.length - 1 && (
                <MenuItemDivider
                  inset={
                    React.isValidElement<SettingsRowProps>(child) &&
                    child.props.icon
                      ? 64
                      : 13
                  }
                />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    </SettingsRowGroupContext.Provider>
  );
};

interface SettingsValueSubtitleProps {
  /** The current choice; falls back to the picker's "Select an option". */
  value: string | undefined;
  /** Explanations of the setting, shown in full beneath the value. */
  description?: string | readonly (string | false | null | undefined)[];
}

/**
 * Subtitle for a row that opens a choice (a BottomSheetPicker trigger or a
 * sheet of its own): the current value on one line, like Theme in App
 * Settings, with any explanation of the setting wrapping freely beneath it.
 */
export function SettingsValueSubtitle({
  value,
  description,
}: SettingsValueSubtitleProps) {
  const { t } = useTranslation();
  const descriptions = (
    Array.isArray(description) ? description : [description]
  ).filter((line): line is string => typeof line === 'string' && line !== '');
  return (
    <>
      <Text
        className="text-sm text-text-secondary"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value ||
          t('common.selectOption', { defaultValue: 'Select an option' })}
      </Text>
      {descriptions.map((line) => (
        <Text key={line} className="text-sm text-text-muted mt-1">
          {line}
        </Text>
      ))}
    </>
  );
}

interface SettingsRowProps {
  icon?: IconName;
  /**
   * A brand's own mark in place of a glyph (a connector such as FitPass): a
   * transparent image, drawn at a glyph's size on the same tile as its
   * neighbours.
   */
  iconImage?: ImageSourcePropType;
  /** A ready-made tile in place of icon or iconImage (Apple Health's icon). */
  iconElement?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** Line clamp for string subtitles; 0 lets the text wrap freely. */
  subtitleNumberOfLines?: number;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
  iconColor?: string;
  iconBackgroundColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  testID?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconImage,
  iconElement,
  title,
  subtitle,
  subtitleNumberOfLines = 1,
  onPress,
  rightAccessory,
  iconColor,
  iconBackgroundColor,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  testID,
}) => {
  const { grouped } = useContext(SettingsRowGroupContext);
  const textSecondary = useCSSVariable('--color-text-secondary') as string;

  const wrapperClass = grouped ? '' : 'bg-surface rounded-2xl mb-4';

  const tintColor = iconColor ?? textSecondary;

  const content = (
    <MenuItem
      leading={
        iconElement ? (
          iconElement
        ) : iconImage ? (
          <MenuItemIcon backgroundColor={iconBackgroundColor}>
            <Image
              source={iconImage}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              // Smaller than a glyph's 22: a logo fills its square edge to edge
              // where a glyph has room around it, so 16 reads the same size.
              style={{ width: 16, height: 16 }}
            />
          </MenuItemIcon>
        ) : icon ? (
          <MenuItemIcon backgroundColor={iconBackgroundColor}>
            <Icon name={icon} size={22} color={tintColor} weight="semibold" />
          </MenuItemIcon>
        ) : null
      }
      trailing={
        rightAccessory !== undefined ? (
          rightAccessory
        ) : onPress ? (
          <Icon name="chevron-forward" size={12} color={textSecondary} />
        ) : null
      }
    >
      <View className="min-w-0">
        <Text
          className="text-base font-semibold text-text-primary"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {typeof subtitle === 'string' ? (
          <Text
            className="text-sm text-text-secondary mt-0.5"
            numberOfLines={subtitleNumberOfLines}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : subtitle ? (
          <View className="mt-0.5">{subtitle}</View>
        ) : null}
      </View>
    </MenuItem>
  );

  if (!onPress) {
    return (
      <View
        className={wrapperClass}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      className={wrapperClass}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) =>
        disabled ? { opacity: 0.5 } : pressed ? { opacity: 0.7 } : null
      }
    >
      {content}
    </Pressable>
  );
};

export default SettingsRow;
