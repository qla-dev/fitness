import AsyncStorage from '@react-native-async-storage/async-storage';
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
  price: z.number().optional(),
});
const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string(),
  store: z.string(),
  archived: z.boolean(),
  items: z.array(itemSchema),
  createdAt: z.string(),
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
