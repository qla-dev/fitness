import { randomUUID } from 'expo-crypto';
import {
  deleteRecord,
  localTransaction,
  saveRecord,
  table,
  type LocalRecord,
} from './local/database';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
} from './online/account';
import { planCurrency } from '../constants/regions';
import { formatLocalizedNumber } from '../localization';
import type { GroceryItem, GroceryList, SetupAnswers } from './personalSetup';

export type PlanIngredient = {
  name: string;
  quantity: number;
  unit: 'g' | 'ml' | 'piece';
  price?: number | null;
  /** The basket staple it was priced from; Croatian plans only. */
  staple?: string;
  /** The shelf product it was priced from, and that product's barcode. */
  product?: string;
  ean?: string | null;
};
export type PlanMeal = {
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: PlanIngredient[];
};
/** weekday 1 = Monday … 7 = Sunday. */
export type PlanDay = { weekday: number; meals: PlanMeal[]; cost: number };

/**
 * A week of meals MarkAI planned from the food and kitchen answers. Saved in
 * the local database's `mealPlans` table, which syncs with the account.
 */
export type WeeklyPlan = {
  id: string;
  title: string;
  summary?: string | null;
  region: string;
  currency: string;
  /** `cijene`: priced from Croatian shelf prices on `price_date`. */
  prices: 'cijene' | 'estimate';
  price_date: string | null;
  weekly_cost: number;
  days: PlanDay[];
  servings: number;
  is_active: boolean;
  created_at?: string;
};

const TABLE = 'mealPlans';
const MUTATION = { method: 'POST', endpoint: '/local/meal-plans' };

export const weeklyPlansQueryKey = ['weeklyPlans'] as const;

const newestFirst = (a: LocalRecord, b: LocalRecord) =>
  String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));

export function listWeeklyPlans(): Promise<WeeklyPlan[]> {
  return localTransaction(
    (db) => [...table(db, TABLE)].sort(newestFirst) as unknown as WeeklyPlan[]
  );
}

/** Makes one plan the active one; every other plan stops being active. */
export function setActiveWeeklyPlan(id: string): Promise<void> {
  return localTransaction((db) => {
    for (const row of table(db, TABLE)) {
      if (Boolean(row.is_active) !== (row.id === id))
        saveRecord(db, TABLE, { is_active: row.id === id }, row.id);
    }
  }, MUTATION);
}

export function deleteWeeklyPlan(id: string): Promise<void> {
  return localTransaction((db) => {
    const wasActive = table(db, TABLE).find((row) => row.id === id)?.is_active;
    deleteRecord(db, TABLE, id);
    // Removing the active plan hands the badge to the newest one left.
    const next = [...table(db, TABLE)].sort(newestFirst)[0];
    if (wasActive && next) saveRecord(db, TABLE, { is_active: true }, next.id);
  }, MUTATION);
}

export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to plan meals with MarkAI.');
    this.name = 'NotSignedInError';
  }
}

/**
 * Asks MarkAI for a week built from the questionnaire answers, saves it as
 * the active plan and returns it. Costs AI coins; the balance is updated
 * from the server's answer. A retry with the same `requestId` is free.
 */
export async function createWeeklyPlan(
  answers: SetupAnswers,
  language: string,
  requestId: string = randomUUID()
): Promise<WeeklyPlan> {
  const session = useOnlineAccount.getState().session;
  if (!session) throw new NotSignedInError();
  const region = String(answers.region || 'HR');
  const response = await onlineRequest<{
    plan: Omit<WeeklyPlan, 'id' | 'servings' | 'is_active'>;
    ai_coins: number;
  }>('/markai/meal-plans', {
    id: requestId,
    preferences: answers,
    region,
    currency: planCurrency(region, String(answers.currency || '')),
    language,
  });
  await updateOnlineAccount({ ...session.user, ai_coins: response.ai_coins });
  const servings = Math.max(1, Number(answers.servings) || 1);
  return localTransaction((db) => {
    for (const row of table(db, TABLE))
      if (row.is_active) saveRecord(db, TABLE, { is_active: false }, row.id);
    return saveRecord(db, TABLE, {
      ...response.plan,
      servings,
      is_active: true,
    }) as unknown as WeeklyPlan;
  }, MUTATION);
}

const UNIT_LABEL: Record<PlanIngredient['unit'], string> = {
  g: 'g',
  ml: 'ml',
  piece: 'pcs',
};

/**
 * One grocery list for the given days: the same ingredient in the same unit
 * is added up across meals, scaled by the plan's servings, and priced from
 * the plan. Names are kept as MarkAI wrote them. Items keep the staple and
 * barcode they were priced from, so the list can be compared across stores
 * and show product photos.
 */
export function planGroceryList(
  plan: WeeklyPlan,
  days: PlanDay[],
  name: string,
  note: string
): GroceryList {
  const totals = new Map<
    string,
    {
      name: string;
      unit: PlanIngredient['unit'];
      quantity: number;
      price: number;
      priced: boolean;
      staple?: string;
      ean?: string;
    }
  >();
  for (const day of days)
    for (const meal of day.meals)
      for (const ingredient of meal.ingredients) {
        const key = `${ingredient.name.trim().toLowerCase()}|${ingredient.unit}`;
        const entry = totals.get(key) ?? {
          name: ingredient.name.trim(),
          unit: ingredient.unit,
          quantity: 0,
          price: 0,
          priced: false,
          staple: ingredient.staple,
          ean: ingredient.ean ?? undefined,
        };
        entry.quantity += ingredient.quantity * plan.servings;
        if (typeof ingredient.price === 'number') {
          entry.price += ingredient.price * plan.servings;
          entry.priced = true;
        }
        totals.set(key, entry);
      }
  const items: GroceryItem[] = [...totals.values()].map((entry) => ({
    id: randomUUID(),
    name: entry.name,
    quantity: `${Math.round(entry.quantity * 10) / 10} ${UNIT_LABEL[entry.unit]}`,
    checked: false,
    ...(entry.priced
      ? {
          price: Math.round(entry.price * 100) / 100,
          basePrice: Math.round(entry.price * 100) / 100,
        }
      : null),
    ...(entry.staple ? { staple: entry.staple } : null),
    ...(entry.ean ? { ean: entry.ean } : null),
  }));
  return {
    id: randomUUID(),
    name,
    note,
    store: '',
    archived: false,
    createdAt: new Date().toISOString(),
    items,
    region: plan.region,
    currency: plan.currency,
  };
}

export const planMoney = (amount: number, currency: string) =>
  formatLocalizedNumber(amount, { style: 'currency', currency });

const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** weekday 1 = Monday … 7 = Sunday, in the app's language. */
export const weekdayName = (
  t: (key: string, options?: Record<string, unknown>) => string,
  weekday: number
) => {
  const key = WEEKDAY_KEYS[weekday - 1] ?? 'monday';
  return t(`mealPlans.weekdays.${key}`, {
    defaultValue: key.charAt(0).toUpperCase() + key.slice(1),
  });
};
