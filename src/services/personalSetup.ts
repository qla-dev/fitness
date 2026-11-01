import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import {
  deleteRecord,
  localTransaction,
  saveRecord,
  table,
  type LocalDatabase,
} from './local/database';
import { fingerprint } from './online/syncModel';

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
  return 'local';
}
/*
 * The questionnaires and grocery lists live in the local database, which
 * syncs with the account: one `personalSetup` record per scope holding the
 * answers, and one `groceryLists` record per list. Each list row carries its
 * scope and its position, so the order the screens show survives a sync.
 */
const SETUP_TABLE = 'personalSetup';
const LISTS_TABLE = 'groceryLists';
const MUTATION = { method: 'PUT', endpoint: '/local/personal-setup' };

const answersOf = (state: PersonalSetup) => ({
  profile: state.profile,
  profileDone: state.profileDone,
  grocery: state.grocery,
  groceryDone: state.groceryDone,
});

const scopeLists = (db: LocalDatabase, scope: string) =>
  table(db, LISTS_TABLE)
    .filter((row) => row.scope === scope)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));

function readFrom(db: LocalDatabase, scope: string): PersonalSetup {
  const row = table(db, SETUP_TABLE).find((r) => r.id === scope);
  // Parsing drops the bookkeeping fields (scope, position, timestamps).
  return stateSchema.parse({ ...row, lists: scopeLists(db, scope) });
}

/** Writes `next`, touching only the records that changed so sync stays quiet. */
function writeTo(db: LocalDatabase, scope: string, next: PersonalSetup): void {
  const answers = answersOf(next);
  const row = table(db, SETUP_TABLE).find((r) => r.id === scope);
  if (!row) saveRecord(db, SETUP_TABLE, { id: scope, ...answers });
  else if (
    fingerprint(answersOf(stateSchema.parse(row))) !== fingerprint(answers)
  )
    saveRecord(db, SETUP_TABLE, answers, scope);

  const stored = new Map(scopeLists(db, scope).map((r) => [String(r.id), r]));
  next.lists.forEach((list, position) => {
    const data = { ...list, scope, position };
    const existing = stored.get(list.id);
    stored.delete(list.id);
    if (!existing) saveRecord(db, LISTS_TABLE, data);
    else if (
      fingerprint({
        ...listSchema.parse(existing),
        position: existing.position,
      }) !== fingerprint({ ...list, position })
    )
      saveRecord(db, LISTS_TABLE, data, list.id);
  });
  for (const id of stored.keys()) deleteRecord(db, LISTS_TABLE, id);
}

/**
 * Where this lived before it synced: one AsyncStorage entry per scope. Moved
 * into the database on first use, then deleted. Lists another device already
 * synced are kept, and the old answers fill in only an empty scope.
 */
const legacyKey = (scope: string) => `@qla/personal-setup/v1/${scope}`;
async function migrateLegacy(scope: string): Promise<void> {
  const raw = await AsyncStorage.getItem(legacyKey(scope));
  if (raw === null) return;
  const legacy = stateSchema.parse(JSON.parse(raw));
  await localTransaction((db) => {
    const current = readFrom(db, scope);
    const hasAnswers = table(db, SETUP_TABLE).some((r) => r.id === scope);
    const known = new Set(current.lists.map((list) => list.id));
    writeTo(db, scope, {
      ...(hasAnswers ? current : legacy),
      lists: [
        ...current.lists,
        ...legacy.lists.filter((list) => !known.has(list.id)),
      ],
    });
  }, MUTATION);
  await AsyncStorage.removeItem(legacyKey(scope));
}

export async function readSetup(scope: string): Promise<PersonalSetup> {
  await migrateLegacy(scope);
  return localTransaction((db) => readFrom(db, scope));
}
/** Applies `update` to the stored state; edits are serialized by the database. */
export async function updateSetup(
  scope: string,
  update: (state: PersonalSetup) => PersonalSetup
): Promise<PersonalSetup> {
  await migrateLegacy(scope);
  return localTransaction((db) => {
    const next = stateSchema.parse(update(readFrom(db, scope)));
    writeTo(db, scope, next);
    return next;
  }, MUTATION);
}
