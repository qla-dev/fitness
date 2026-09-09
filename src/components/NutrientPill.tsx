import React from 'react';
import { View, Text } from 'react-native';
import Icon, { type IconName } from './Icon';

interface NutrientPillProps {
  label: string;
  consumed: number;
  goal?: number;
  unit?: string;
  icon?: IconName;
  color?: string;
}

const NutrientPill: React.FC<NutrientPillProps> = ({
  label,
  consumed,
  goal,
  unit = 'g',
  icon,
  color,
}) => {
  return (
    // Light theme used to paint these on `--color-border` (a visible grey)
    // while every other card sits on `--color-surface`, so the macro row read
    // as a different kind of surface from the cards around it. One token in
    // both themes now, matching the rest.
    <View className="w-[23%] bg-surface rounded-xl px-0.5 py-2 items-center">
      {icon && (
        <Icon name={icon} size={18} color={color} style={{ marginBottom: 4 }} />
      )}
      <Text className="text-xs text-text-primary mb-1" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-xs font-bold text-text-primary text-center"
        numberOfLines={1}
      >
        {goal && goal > 0
          ? `${Math.round(consumed)}${unit} / ${Math.round(goal)}${unit}`
          : `${Math.round(consumed)}${unit}`}
      </Text>
    </View>
  );
};

export default NutrientPill;
