import React from 'react';
import { Text, View } from 'react-native';

/**
 * One part of the day's log: a heading, a line on what it is for, then the
 * control, straight on the page. Cards inside cards read as clutter on a form
 * this long, so the sections are separated by space alone.
 */
export default function LogSection({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  /** An action opposite the title, like the symptoms' Show all. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View>
        <View className="flex-row items-center justify-between">
          <Text className="text-text-primary text-base font-semibold flex-1">
            {title}
          </Text>
          {right}
        </View>
        {subtitle ? (
          <Text className="text-text-secondary text-sm mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
