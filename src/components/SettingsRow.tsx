import React, { createContext, useContext } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

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
                <View
                  className="bg-border-subtle"
                  style={{
                    height:
                      Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
                    marginStart:
                      React.isValidElement<SettingsRowProps>(child) &&
                      child.props.icon
                        ? 68
                        : 16,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    </SettingsRowGroupContext.Provider>
  );
};

interface SettingsRowProps {
  icon?: IconName;
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
  const [textSecondary, raised] = useCSSVariable([
    '--color-text-secondary',
    '--color-raised',
  ]) as [string, string];

  const wrapperClass = grouped
    ? 'p-4 flex-row items-center'
    : 'bg-surface rounded-2xl p-4 mb-4 flex-row items-center';

  const tintColor = iconColor ?? textSecondary;
  const tileBg = iconBackgroundColor ?? raised;

  const content = (
    <>
      {icon ? (
        <View
          className="w-10 h-10 rounded-lg items-center justify-center mr-3"
          style={{ backgroundColor: tileBg }}
        >
          <Icon name={icon} size={22} color={tintColor} weight="semibold" />
        </View>
      ) : null}
      <View className="flex-1 mr-2">
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
      {rightAccessory !== undefined ? (
        rightAccessory
      ) : onPress ? (
        <Icon name="chevron-forward" size={12} color={textSecondary} />
      ) : null}
    </>
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
