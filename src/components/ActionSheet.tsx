import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PromptSheet, { dismissPromptSheet } from './ui/PromptSheet';

export interface ActionSheetItem {
  key: string;
  label: string;
  /**
   * Consecutive items sharing a group render as one block, separated from
   * adjacent blocks by a spacer band. Ungrouped items chunk together.
   */
  group?: string;
  /** Danger tint on the label. */
  destructive?: boolean;
  /**
   * Default true. False keeps the sheet presented so the item can swap the
   * content in place (e.g. a main menu → pick-list stage).
   */
  dismissOnPress?: boolean;
  onPress: () => void;
}

export interface ActionSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ActionSheetProps {
  title: string;
  items: ActionSheetItem[];
  /** Adds a Back action in the header (content-swap flows). */
  onBack?: () => void;
  onDismiss?: () => void;
}

/**
 * A menu of one-shot actions under a title: overflow and context menus.
 * Selection state belongs to BottomSheetPicker.
 *
 * It is {@link PromptSheet}, GoalEdit's modal route, in its list layout: each
 * group of actions is one card. Owners set the state that drives
 * `title`/`items` before calling `present()`; the sheet shows whatever they
 * hold while it is open.
 */
const ActionSheet = React.forwardRef<ActionSheetRef, ActionSheetProps>(
  ({ title, items, onBack, onDismiss }, ref) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const openRef = useRef(false);
    useEffect(() => {
      openRef.current = open;
    }, [open]);

    const close = () => {
      // At once, so an action that navigates lands on top of the screen the
      // menu came from, not under the menu's route.
      if (openRef.current) dismissPromptSheet();
      openRef.current = false;
      setOpen(false);
    };

    useImperativeHandle(ref, () => ({
      present: () => {
        openRef.current = true;
        setOpen(true);
      },
      dismiss: close,
    }));

    const wasOpen = useRef(false);
    useEffect(() => {
      if (wasOpen.current && !open) onDismiss?.();
      wasOpen.current = open;
      // Only the open state decides; onDismiss is read as it is now.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleItemPress = (item: ActionSheetItem) => {
      if (item.dismissOnPress !== false) close();
      item.onPress();
    };

    const sections: ActionSheetItem[][] = [];
    for (const item of items) {
      const current = sections[sections.length - 1];
      if (current && current[0].group === item.group) {
        current.push(item);
      } else {
        sections.push([item]);
      }
    }

    return (
      <PromptSheet
        open={open}
        onClose={() => setOpen(false)}
        headerTitle=""
        title={title}
        topAligned
        headerRight={
          onBack
            ? {
                kind: 'text',
                label: t('common.back', { defaultValue: 'Back' }),
                onPress: onBack,
              }
            : undefined
        }
      >
        <View className="gap-3">
          {sections.map((section) => (
            <View
              key={section[0].key}
              testID="action-sheet-group"
              className="bg-surface rounded-2xl overflow-hidden"
            >
              {section.map((item, itemIndex) => (
                <Pressable
                  key={item.key}
                  testID={`action-sheet-item-${item.key}`}
                  onPress={() => handleItemPress(item)}
                  className={`flex-row items-center px-4 py-3.5 ${
                    itemIndex < section.length - 1
                      ? 'border-b border-border-subtle'
                      : ''
                  }`}
                  style={
                    itemIndex < section.length - 1
                      ? { borderBottomWidth: StyleSheet.hairlineWidth }
                      : undefined
                  }
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text
                    className={`text-base font-medium ${
                      item.destructive
                        ? 'text-text-danger-subtle'
                        : 'text-text-primary'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </PromptSheet>
    );
  }
);

ActionSheet.displayName = 'ActionSheet';

export default ActionSheet;
