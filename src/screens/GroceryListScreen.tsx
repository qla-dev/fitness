import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import SwipeableDeleteRow from '../components/SwipeableDeleteRow';
import GroceryCheck from '../components/GroceryCheck';
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

  // Every change saves itself, a moment after the last one and again on the
  // way out; there is no Save button and nothing to discard. A list that is
  // not stored yet (a plan's, or a new one) is saved once it has content.
  const persist = setup.save;
  const fallbackName = t('screens.cart', { defaultValue: 'Grocery List' });
  const lastSaved = useRef(saved ? JSON.stringify(saved) : null);
  const pending = useRef<GroceryList | null>(null);
  const flush = useEffectEvent(() => {
    const list = pending.current;
    pending.current = null;
    if (!list) return;
    const cleaned: GroceryList = {
      ...list,
      name: list.name.trim() || fallbackName,
      items: list.items
        .filter((i) => i.name.trim())
        .map((i) => ({ ...i, name: i.name.trim() })),
    };
    lastSaved.current = JSON.stringify(list);
    persist((state) => withList(state, cleaned)).catch(() => setError(true));
  });
  useEffect(() => {
    if (!draft || leaving.current) return;
    const serial = JSON.stringify(draft);
    const hasContent =
      !!draft.name.trim() || draft.items.some((i) => i.name.trim());
    if (serial === lastSaved.current || !hasContent) return;
    pending.current = draft;
    const timer = setTimeout(() => flush(), 600);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(
    () => navigation.addListener('beforeRemove', () => flush()),
    [navigation]
  );

  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    pending.current = null;
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
      draft?.name.trim() || t('screens.cart', { defaultValue: 'Grocery List' }),
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
          paddingTop: 0,
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
        {/* One compact card: what is left to buy first, ticked items under it,
            dimmed. Swipe a row left (or long-press it) to remove it. */}
        {draft.items.length > 0 ? (
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-text-secondary text-sm font-semibold">
              {t('groceries.progress', {
                defaultValue: '{{done}} of {{total}} in the basket',
                done: draft.items.filter((i) => i.checked).length,
                total: draft.items.length,
              })}
            </Text>
            {total !== null ? (
              <Text className="text-text-secondary text-sm">
                {t('groceries.leftToBuy', {
                  defaultValue: '{{amount}} left',
                  amount: planMoney(
                    draft.items
                      .filter((i) => !i.checked)
                      .reduce((sum, i) => sum + (i.price ?? 0), 0),
                    currency
                  ),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View className="bg-surface rounded-2xl overflow-hidden mb-3">
          {[...draft.items]
            .sort((x, y) => Number(x.checked) - Number(y.checked))
            .map((item, index) => (
              <SwipeableDeleteRow
                key={item.id}
                title={
                  item.name || t('groceries.item', { defaultValue: 'Item' })
                }
                onConfirmDelete={() =>
                  update({
                    items: draft.items.filter((i) => i.id !== item.id),
                  })
                }
                className={index > 0 ? 'border-t border-border-subtle' : ''}
              >
                {/* The Tracker's compact food row: a 39pt tile, the name over
                    a small quantity line, the price on the right, all centred
                    on one axis. The text stays editable in place. */}
                <View
                  className="flex-row items-center px-4"
                  style={{
                    minHeight: 64,
                    gap: 12,
                    opacity: item.checked ? 0.55 : 1,
                  }}
                >
                  <GroceryCheck
                    checked={item.checked}
                    label={
                      item.name || t('groceries.item', { defaultValue: 'Item' })
                    }
                    onToggle={() =>
                      updateItem(item.id, { checked: !item.checked })
                    }
                  />
                  <ProductThumb ean={item.ean} size={39} />
                  <View className="flex-1 justify-center" style={{ gap: 3 }}>
                    <TextInput
                      accessibilityLabel={t('groceries.item', {
                        defaultValue: 'Item',
                      })}
                      value={item.name}
                      maxLength={160}
                      placeholder={t('groceries.item', {
                        defaultValue: 'Item',
                      })}
                      onChangeText={(name) => updateItem(item.id, { name })}
                      className={`text-text-primary ${item.checked ? 'line-through' : ''}`}
                      style={{ fontSize: 16, paddingVertical: 0 }}
                    />
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
                        updateItem(item.id, { quantity })
                      }
                      className="text-text-secondary"
                      style={{ fontSize: 12, paddingVertical: 0 }}
                    />
                  </View>
                  {typeof item.price === 'number' ? (
                    <Text
                      className="text-text-secondary"
                      style={{ fontSize: 14, fontWeight: '500' }}
                    >
                      {planMoney(item.price, currency)}
                    </Text>
                  ) : null}
                </View>
              </SwipeableDeleteRow>
            ))}
        </View>
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
