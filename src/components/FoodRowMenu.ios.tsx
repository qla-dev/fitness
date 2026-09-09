import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { FoodRowMenuProps } from './FoodRowMenu';

export default function FoodRowMenu({
  children,
  title,
  width,
  onDelete,
  onAdjustServing,
}: FoodRowMenuProps) {
  const { t } = useTranslation();
  const deleteColor = useCSSVariable('--color-icon-danger') as string;
  const pendingAction = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pendingAction.current) clearTimeout(pendingAction.current);
    },
    []
  );
  const actions: MenuAction[] = [
    ...(onAdjustServing
      ? [
          {
            id: 'adjust',
            title: t('foodRow.adjustServing', {
              defaultValue: 'Adjust serving',
            }),
            image: 'slider.horizontal.3' as const,
          },
        ]
      : []),
    {
      id: 'delete',
      title: t('common.delete', { defaultValue: 'Delete' }),
      image: 'trash',
      imageColor: deleteColor,
      attributes: { destructive: true },
    },
  ];
  return (
    <View style={{ alignSelf: 'stretch', width }}>
      <MenuView
        style={{ alignSelf: 'stretch', width: width ?? '100%' }}
        actions={[
          {
            id: 'food-actions',
            title,
            displayInline: true,
            subactions: actions,
          },
        ]}
        shouldOpenOnLongPress
        onPressAction={({ nativeEvent }) => {
          const action =
            nativeEvent.event === 'delete'
              ? onDelete
              : nativeEvent.event === 'adjust'
                ? onAdjustServing
                : undefined;
          if (!action) return;
          if (pendingAction.current) clearTimeout(pendingAction.current);
          pendingAction.current = setTimeout(action, 250);
        }}
      >
        <View collapsable={false} style={{ width: width ?? '100%' }}>
          {children}
        </View>
      </MenuView>
    </View>
  );
}
