import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { randomUUID } from 'expo-crypto';
import Button from '../components/ui/Button';
import ProductThumb from '../components/ProductThumb';
import SettingsRow from '../components/SettingsRow';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { withList, type GroceryList } from '../services/personalSetup';
import { listTotal } from '../services/online/prices';
import { planMoney } from '../services/weeklyPlans';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * One grocery list, pushed onto the stack from the list of lists so it
 * slides in like every other screen. A list from a meal plan shows what
 * each item costs at its store, and the header's store button reopens the
 * ShopComparison to buy it somewhere else.
 */
export default function GroceryListScreen({
  navigation,
  route,
}: RootStackScreenProps<'GroceryList'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const setup = usePersonalSetup();
  const saved = setup.state?.lists.find(
    (list) => list.id === (route.params.listId ?? route.params.draft?.id)
  );
  const initial = saved ?? route.params.draft ?? null;
  const [draft, setDraft] = useState<GroceryList | null>(initial);
  // The saved list arrives after the first render when opened by id.
  if (!draft && initial) setDraft(initial);
  // The store picked on ShopComparison comes back as the repriced list.
  const [pick, setPick] = useState(route.params.pickedList);
  if (route.params.pickedList !== pick) {
    setPick(route.params.pickedList);
    if (route.params.pickedList) setDraft(route.params.pickedList);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const leaving = useRef(false);
  // Against what the screen opened on, so an untouched blank list leaves
  // without asking.
  const dirty =
    !!draft && !!initial && JSON.stringify(initial) !== JSON.stringify(draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Back, swipe and the hardware button all ask before unsaved edits go.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current || !dirtyRef.current) return;
        event.preventDefault();
        Alert.alert(
          t('groceries.discardTitle', {
            defaultValue: 'Discard unsaved changes?',
          }),
          undefined,
          [
            {
              text: t('common.cancel', { defaultValue: 'Cancel' }),
              style: 'cancel',
            },
            {
              text: t('groceries.discard', { defaultValue: 'Discard' }),
              style: 'destructive',
              onPress: () => navigation.dispatch(event.data.action),
            },
          ]
        );
      }),
    [navigation, t]
  );

  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
      leaving.current = true;
      navigation.goBack();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const save = (list: GroceryList) =>
    run(() =>
      setup.save((state) =>
        withList(state, {
          ...list,
          name: list.name.trim(),
          items: list.items
            .filter((i) => i.name.trim())
            .map((i) => ({ ...i, name: i.name.trim() })),
        })
      )
    );

  const currency = draft?.currency ?? 'EUR';
  const total = draft ? listTotal(draft) : null;
  const compareStores = () => {
    if (draft)
      navigation.navigate('ShopComparison', { list: draft, mode: 'pick' });
  };
  const header = useScreenHeader({
    title:
      draft?.name.trim() ||
      t('screens.cart', { defaultValue: 'Grocery List' }),
    left: { kind: 'back' },
    right: [
      ...(draft?.region
        ? [
            {
              kind: 'icon' as const,
              sfSymbol: 'storefront',
              ionicon: 'storefront-outline',
              accessibilityLabel: t('shopComparison.open', {
                defaultValue: 'Compare stores',
              }),
              onPress: compareStores,
              disabled: busy,
              separated: true,
              identifier: 'grocery-list-compare-stores',
            },
          ]
        : []),
      {
        kind: 'primary' as const,
        onPress: () => draft && void save(draft),
        disabled: !draft?.name.trim(),
        busy,
      },
    ],
  });

  if (!draft)
    return (
      <View className="flex-1 bg-background">
        {header}
        <View className="flex-1 items-center justify-center">
          {setup.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-text-secondary">
              {t('groceries.missing', {
                defaultValue: 'This list was deleted.',
              })}
            </Text>
          )}
        </View>
      </View>
    );

  const existing = !!saved;
  const update = (patch: Partial<GroceryList>) =>
    setDraft({ ...draft, ...patch });
  const updateItem = (
    id: string,
    patch: Partial<GroceryList['items'][number]>
  ) =>
    update({
      items: draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: native ? 0 : insets.top }}
    >
      {header}
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior={native ? 'automatic' : 'never'}
        bottomOffset={24}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {draft.region ? (
          <SettingsRow
            icon="cart"
            title={
              draft.vendor
                ? draft.store
                : t('shopComparison.planPrices', {
                    defaultValue: 'Typical prices',
                  })
            }
            subtitle={t('groceries.listTotal', {
              defaultValue: 'Total {{total}}',
              total: total === null ? '—' : planMoney(total, currency),
            })}
            onPress={compareStores}
            accessibilityHint={t('shopComparison.open', {
              defaultValue: 'Compare stores',
            })}
          />
        ) : null}
        <Text className="text-text-secondary mb-2">
          {t('groceries.listName', { defaultValue: 'List name' })}
        </Text>
        <TextInput
          accessibilityLabel={t('groceries.listName', {
            defaultValue: 'List name',
          })}
          value={draft.name}
          maxLength={100}
          onChangeText={(name) => update({ name })}
          className="text-text-primary bg-surface rounded-2xl p-4 text-2xl font-bold mb-4"
        />
        <Text className="text-text-secondary mb-2">
          {t('groceries.store', { defaultValue: 'Store' })}
        </Text>
        <TextInput
          accessibilityLabel={t('groceries.store', { defaultValue: 'Store' })}
          value={draft.store}
          maxLength={160}
          // A store typed by hand is no longer the compared chain.
          onChangeText={(store) => update({ store, vendor: undefined })}
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
          onChangeText={(note) => update({ note })}
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
                onPress={() => updateItem(item.id, { checked: !item.checked })}
                className={`w-8 h-8 rounded-full border border-accent-primary ${item.checked ? 'bg-accent-primary' : ''}`}
              />
              {item.ean ? <ProductThumb ean={item.ean} /> : null}
              <TextInput
                accessibilityLabel={t('groceries.item', {
                  defaultValue: 'Item',
                })}
                value={item.name}
                maxLength={160}
                onChangeText={(name) => updateItem(item.id, { name })}
                className={`text-text-primary flex-1 p-2 ${item.checked ? 'line-through' : ''}`}
              />
              {typeof item.price === 'number' ? (
                <Text className="text-text-primary font-semibold">
                  {planMoney(item.price, currency)}
                </Text>
              ) : null}
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
                onChangeText={(quantity) => updateItem(item.id, { quantity })}
                className="text-text-secondary flex-1 p-2"
              />
              <Button
                variant="ghost"
                onPress={() =>
                  update({ items: draft.items.filter((i) => i.id !== item.id) })
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
            update({
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
              onPress={() => void save({ ...draft, archived: !draft.archived })}
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
                      onPress: () =>
                        void run(() =>
                          setup.save((state) => ({
                            ...state,
                            lists: state.lists.filter((l) => l.id !== draft.id),
                          }))
                        ),
                    },
                  ]
                )
              }
            >
              {t('groceries.delete', { defaultValue: 'Delete list' })}
            </Button>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
