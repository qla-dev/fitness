import type { ReactNode } from 'react';
import { Text } from 'react-native';

/** Shared Home card and section heading: 18pt, semibold, primary text. */
export default function DashboardCardTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-lg font-semibold text-text-primary flex-shrink ${className}`}
    >
      {children}
    </Text>
  );
}
