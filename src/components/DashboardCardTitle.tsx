import type { ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * Shared Home card and section heading: 18pt, semibold, primary text.
 * Always one line and never shrunk: in a half-width tile a shrinkable title
 * broke mid-word ("Vježbanj/e") instead of letting the spacer beside it give
 * way, so the spacer and chevron absorb the squeeze instead.
 */
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
      numberOfLines={1}
      className={`text-lg font-semibold text-text-primary flex-shrink-0 ${className}`}
    >
      {children}
    </Text>
  );
}
