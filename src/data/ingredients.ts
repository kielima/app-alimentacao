import seed from '../../seed/ingredients.json';
import type { IngredientsSeed, Ingredient } from '../types/ingredient';

const data = seed as IngredientsSeed;

export const allIngredients: Ingredient[] = data.ingredients;

export function findIngredientById(id: string): Ingredient | undefined {
  return allIngredients.find((i) => i.id === id);
}
