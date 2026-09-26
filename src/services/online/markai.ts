import { z } from 'zod';
import { localTransaction, saveRecord, table } from '../local/database';
import { getTodayDate } from '../../utils/dateUtils';

export const foodProposalSchema = z.object({
  name: z.string().min(1).max(200),
  serving: z.string().min(1).max(200),
  calories: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
});
export type FoodProposal = z.infer<typeof foodProposalSchema>;
export type MarkaiReply = {
  text: string;
  food: FoodProposal | null;
  food_id: string;
  log_requested: boolean;
};
export type MarkaiMessage = { id: string; prompt: string; reply: MarkaiReply };

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
