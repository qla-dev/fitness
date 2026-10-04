import { z } from 'zod';
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { localTransaction, saveRecord, table } from '../local/database';
import { getTodayDate } from '../../utils/dateUtils';
import { externalFoodItemToFoodInfo } from '../../types/foodInfo';

export const foodProposalSchema = z.object({
  name: z.string().min(1).max(200),
  serving: z.string().min(1).max(200),
  calories: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
});
export type FoodProposal = z.infer<typeof foodProposalSchema>;
export type MarkaiMode = 'macros' | 'training' | 'free';
/** One conversation in the history list. */
export type MarkaiThread = {
  conversation_id: string;
  mode: MarkaiMode;
  title: string;
  updated_at: string;
  message_count: number;
};
/**
 * A daily goal MarkAI worked out, offered for the user to apply. Never
 * applied by itself: applying pre-fills the goal for review.
 */
export type GoalProposal =
  /** kcal a day, or protein, carbs or fat in grams a day. */
  | { key: 'calories' | 'protein' | 'carbs' | 'fat'; value: number }
  /** The paid macro plan: all four at once. */
  | {
      key: 'macros';
      values: { calories: number; protein: number; carbs: number; fat: number };
    };
/**
 * A request priced above a reply. The backend sets the price
 * (fitness.markai_task_coins); MARKAI_TASK_COINS only tells the user.
 */
export type MarkaiTask = 'all_macros';
export const MARKAI_TASK_COINS: Record<MarkaiTask, number> = { all_macros: 10 };
export type MarkaiReply = {
  text: string;
  food: FoodProposal | null;
  /** Absent on replies from before goals were proposed. */
  goal?: GoalProposal | null;
  food_id: string;
  log_requested: boolean;
};
export type MarkaiMessage = {
  id: string;
  prompt: string;
  /** Shown instead of a prompt the app wrote for the user. */
  label?: string | null;
  reply: MarkaiReply;
  /** The server keeps only this flag; the photo itself is never stored there. */
  has_image?: boolean;
  /** The photo as sent from this device, kept by `markaiImages.ts`. */
  imageUri?: string;
};

// A vision model reads a meal as well at 1024px as at full size, and the
// request stays a few hundred kilobytes instead of several megabytes.
const MARKAI_IMAGE_EDGE = 1024;

/** Downscale a picked photo into the JPEG data URL the MarkAI endpoint takes. */
export async function prepareMarkaiImage(uri: string) {
  const { width, height } = await Image.getSize(uri);
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    Math.max(width, height) > MARKAI_IMAGE_EDGE
      ? [
          {
            resize:
              width >= height
                ? { width: MARKAI_IMAGE_EDGE }
                : { height: MARKAI_IMAGE_EDGE },
          },
        ]
      : [],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  if (!processed.base64) throw new Error('Photo could not be prepared');
  return {
    uri: processed.uri,
    data: 'data:image/jpeg;base64,' + processed.base64,
  };
}

/** A proposal is only a draft; the shared food-entry modal owns confirmation. */
export function markaiFoodToFoodInfo(id: string, proposal: FoodProposal) {
  const food = foodProposalSchema.parse(proposal);
  return externalFoodItemToFoodInfo({
    id,
    name: food.name,
    brand: null,
    source: 'markai',
    is_custom: true,
    serving_size: 1,
    serving_unit: food.serving,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  });
}

/** Stable proposal IDs make repeated confirmation and network retries harmless. */
export async function logMarkaiFood(
  proposalId: string,
  proposal: FoodProposal,
  mealTypeId: string,
  date = getTodayDate()
) {
  const food = foodProposalSchema.parse(proposal);
  return localTransaction(
    (db) => {
      if (table(db, 'markaiReceipts').some((row) => row.id === proposalId))
        return;
      const meal = table(db, 'mealTypes').find((row) => row.id === mealTypeId);
      if (!meal) throw new Error('Choose a meal before logging food.');
      if (!table(db, 'entries').some((row) => row.id === proposalId))
        saveRecord(db, 'entries', {
          id: proposalId,
          food_name: food.name,
          quantity: 1,
          unit: food.serving,
          serving_size: 1,
          serving_unit: food.serving,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          meal_type_id: meal.id,
          meal_type: meal.name,
          entry_date: date,
        });
      saveRecord(db, 'markaiReceipts', { id: proposalId, entry_date: date });
    },
    { method: 'POST', endpoint: '/markai/log-food', body: { proposalId } }
  );
}

/**
 * A reply as plain text. MarkAI is told not to write markdown, but replies
 * from before that, and a model that slips, still arrive with it — shown as
 * written, that is literal asterisks around every heading. Only the markers
 * go: emphasis pairs, backticks, heading hashes and list stars. A lone
 * asterisk between figures is multiplication and stays.
 */
export function plainReplyText(text: string): string {
  return (
    text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`+/g, '')
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^([ \t]*)[*-][ \t]+/gm, '$1• ')
      // Numbered steps run together on one line ("…kcal. 2. Your…") each
      // start a line of their own. Only after a sentence ends, so a decimal
      // such as 2073.75 is never split.
      .replace(/([.!?:])[ \t]+(?=\d{1,2}\.[ \t])/g, '$1\n')
  );
}
