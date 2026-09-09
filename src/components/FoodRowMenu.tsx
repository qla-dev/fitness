import type { ReactNode } from 'react';

export interface FoodRowMenuProps {
  children: ReactNode;
  title: string;
  width?: number;
  onDelete: () => void;
  onAdjustServing?: () => void;
}

// Android keeps the row's existing long-press dialog.
export default function FoodRowMenu({ children }: FoodRowMenuProps) {
  return <>{children}</>;
}
