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
export type MarkaiReply = {
  text: string;
  food: FoodProposal | null;
  food_id: string;
  log_requested: boolean;
};
export type MarkaiMessage = {
  id: string;
  prompt: string;
  reply: MarkaiReply;
  /** The server keeps only this flag; the photo itself is never stored. */
  has_image?: boolean;
  /** The photo as sent from this device, shown until the chat is reloaded. */
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
