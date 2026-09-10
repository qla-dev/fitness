import { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import Button from './ui/Button';
import type { GroceryList } from '../services/personalSetup';

export default function GroceryListEditor({
  initial,
  existing,
  onClose,
  onSave,
  onDelete,
}: {
  initial: GroceryList;
  existing: boolean;
  onClose: () => void;
  onSave: (list: GroceryList) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
      onClose();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const save = (list: GroceryList) =>
    run(() =>
      onSave({
        ...list,
        name: list.name.trim(),
        items: list.items
          .filter((i) => i.name.trim())
          .map((i) => ({ ...i, name: i.name.trim() })),
      })
    );
  const close = () => {
    if (busy) return;
    if (JSON.stringify(initial) === JSON.stringify(draft)) {
      onClose();
      return;
    }
    Alert.alert(
      t('groceries.discardTitle', { defaultValue: 'Discard unsaved changes?' }),
      undefined,
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('groceries.discard', { defaultValue: 'Discard' }),
          style: 'destructive',
          onPress: onClose,
        },
      ]
    );
  };
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row justify-between px-4 py-3">
          <Button variant="ghost" disabled={busy} onPress={close}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            loading={busy}
            disabled={!draft.name.trim()}
            onPress={() => void save(draft)}
          >
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          <Text className="text-text-secondary mb-2">
            {t('groceries.listName', { defaultValue: 'List name' })}
          </Text>
          <TextInput
            accessibilityLabel={t('groceries.listName', {
              defaultValue: 'List name',
            })}
            value={draft.name}
            maxLength={100}
            onChangeText={(name) => setDraft({ ...draft, name })}
            className="text-text-primary bg-surface rounded-2xl p-4 text-2xl font-bold mb-4"
          />
          <Text className="text-text-secondary mb-2">
            {t('groceries.store', { defaultValue: 'Store' })}
          </Text>
          <TextInput
            accessibilityLabel={t('groceries.store', { defaultValue: 'Store' })}
            value={draft.store}
            maxLength={160}
            onChangeText={(store) => setDraft({ ...draft, store })}
            className="text-text-primary bg-surface rounded-2xl p-4 mb-4"
          />
          <Text className="text-text-secondary mb-2">
            {t('groceries.notes', { defaultValue: 'Notes' })}
          </Text>
          <TextInput
            accessibilityLabel={t('groceries.notes', { defaultValue: 'Notes' })}
            value={draft.note}
            multiline
            maxLength={4000}
            onChangeText={(note) => setDraft({ ...draft, note })}
            className="text-text-primary bg-surface rounded-2xl p-4 mb-5"
          />
          {draft.items.map((item) => (
            <View key={item.id} className="bg-surface rounded-2xl p-3 mb-2">
              <View className="flex-row items-center gap-3">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={
                    item.name || t('groceries.item', { defaultValue: 'Item' })
                  }
                  accessibilityState={{ checked: item.checked }}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((i) =>
                        i.id === item.id ? { ...i, checked: !i.checked } : i
                      ),
                    })
                  }
                  className={`w-8 h-8 rounded-full border border-accent-primary ${item.checked ? 'bg-accent-primary' : ''}`}
                />
                <TextInput
                  accessibilityLabel={t('groceries.item', {
                    defaultValue: 'Item',
                  })}
                  value={item.name}
                  maxLength={160}
                  onChangeText={(name) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((i) =>
                        i.id === item.id ? { ...i, name } : i
                      ),
                    })
                  }
                  className={`text-text-primary flex-1 p-2 ${item.checked ? 'line-through' : ''}`}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <TextInput
                  accessibilityLabel={t('groceries.quantity', {
                    defaultValue: 'Quantity',
                  })}
                  value={item.quantity}
                  maxLength={60}
                  placeholder={t('groceries.quantity', {
                    defaultValue: 'Quantity',
                  })}
                  onChangeText={(quantity) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((i) =>
                        i.id === item.id ? { ...i, quantity } : i
                      ),
                    })
                  }
                  className="text-text-secondary flex-1 p-2"
                />
                <Button
                  variant="ghost"
                  onPress={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.filter((i) => i.id !== item.id),
                    })
                  }
                >
                  {t('common.remove', { defaultValue: 'Remove' })}
                </Button>
              </View>
            </View>
          ))}
          <Button
            variant="secondary"
            onPress={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  { id: randomUUID(), name: '', quantity: '', checked: false },
                ],
              })
            }
          >
            {t('groceries.addItem', { defaultValue: 'Add item' })}
          </Button>
          {error && (
            <Text accessibilityRole="alert" className="text-icon-danger mt-3">
              {t('setup.saveError', {
                defaultValue:
                  'Could not save. Your answers are still here. Please try again.',
              })}
            </Text>
          )}
          {existing && (
            <View className="mt-6 gap-2">
              <Button
                variant="outline"
                disabled={busy || !draft.name.trim()}
                onPress={() =>
                  void save({
                    ...draft,
                    id: randomUUID(),
                    createdAt: new Date().toISOString(),
                    name: t('groceries.copyName', {
                      defaultValue: '{{name}} (copy)',
                      name: draft.name,
                    }),
                  })
                }
              >
                {t('groceries.duplicate', { defaultValue: 'Duplicate list' })}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !draft.name.trim()}
                onPress={() =>
                  void save({ ...draft, archived: !draft.archived })
                }
              >
                {draft.archived
                  ? t('groceries.restore', { defaultValue: 'Restore list' })
                  : t('groceries.archive', { defaultValue: 'Archive list' })}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    t('groceries.deleteTitle', {
                      defaultValue: 'Delete this list?',
                    }),
                    draft.name,
                    [
                      {
                        text: t('common.cancel', { defaultValue: 'Cancel' }),
                        style: 'cancel',
                      },
                      {
                        text: t('common.delete', { defaultValue: 'Delete' }),
                        style: 'destructive',
                        onPress: () => void run(onDelete),
                      },
                    ]
                  )
                }
              >
                {t('groceries.delete', { defaultValue: 'Delete list' })}
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
