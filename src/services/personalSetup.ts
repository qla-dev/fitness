import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { isLocalDataMode } from './dataMode';
import { getActiveServerConfig } from './storage';

export const answersSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
);
export type SetupAnswers = z.infer<typeof answersSchema>;
const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.string(),
  checked: z.boolean(),
  /** What the item costs at the list's store, or at plan prices. */
  price: z.number().optional(),
  /** The meal plan's price, which every store's price is compared from. */
  basePrice: z.number().optional(),
  /** The basket staple a meal plan priced it from (backend CroatianPrices). */
  staple: z.string().optional(),
  /** The barcode of the product it was priced from, for its photo. */
  ean: z.string().optional(),
});
const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string(),
  store: z.string(),
  archived: z.boolean(),
  items: z.array(itemSchema),
  createdAt: z.string(),
  /** Shopping region and currency of a list made from a meal plan. */
  region: z.string().optional(),
  currency: z.string().optional(),
  /** The chain code picked in the shop comparison; `store` is its name. */
  vendor: z.string().optional(),
});
export type GroceryList = z.infer<typeof listSchema>;
export type GroceryItem = z.infer<typeof itemSchema>;
const stateSchema = z.object({
  profile: answersSchema.default({}),
  profileDone: z.boolean().default(false),
  grocery: answersSchema.default({}),
  groceryDone: z.boolean().default(false),
  lists: z.array(listSchema).default([]),
});
export type PersonalSetup = z.infer<typeof stateSchema>;
export const emptySetup = (): PersonalSetup => stateSchema.parse({});
/** An empty list, ready to be named. */
export const blankGroceryList = (): GroceryList => ({
  id: randomUUID(),
  name: '',
  note: '',
  store: '',
  archived: false,
  items: [],
  createdAt: new Date().toISOString(),
});
/** The state with `list` saved: replaced in place, or added first. */
export const withList = (
  state: PersonalSetup,
  list: GroceryList
): PersonalSetup => ({
  ...state,
  lists: state.lists.some((l) => l.id === list.id)
    ? state.lists.map((l) => (l.id === list.id ? list : l))
    : [list, ...state.lists],
});
export async function setupScope(): Promise<string> {
  if (isLocalDataMode()) return 'local';
  const config = await getActiveServerConfig();
  if (!config) throw new Error('No active account');
  return config.id;
}
const key = (scope: string) => `@qla/personal-setup/v1/${scope}`;
export async function readSetup(scope: string): Promise<PersonalSetup> {
  const raw = await AsyncStorage.getItem(key(scope));
  return raw === null ? emptySetup() : stateSchema.parse(JSON.parse(raw));
}
let queue: Promise<unknown> = Promise.resolve();
export function updateSetup(
  scope: string,
  update: (state: PersonalSetup) => PersonalSetup
): Promise<PersonalSetup> {
  const task = queue.then(async () => {
    const next = stateSchema.parse(update(await readSetup(scope)));
    await AsyncStorage.setItem(key(scope), JSON.stringify(next));
    return next;
  });
  queue = task.catch(() => undefined);
  return task;
}
