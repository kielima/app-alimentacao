import type { Ingredient } from '../types/ingredient';
import type { Meal } from '../types/meal';
import type { Recipe } from '../types/recipe';
import type { PantryItem } from '../types/pantry';

/**
 * Detecta dados faltantes que atrapalham o plano:
 *  - ingredientes sem tabela nutricional (`nutrition_per_100`);
 *  - ingredientes sem porção padrão (`serving_size_g`) quando são usados com
 *    uma medida que precisa dela (unidade, fatia, xícara, colher…);
 *  - itens de refeições/receitas sem quantidade;
 *  - itens de comida na dispensa sem data de validade (não entram no controle de
 *    vencimento nem na priorização da montagem automática do plano).
 */

export interface RecipeGap {
  recipe: Recipe;
  missingCount: number;
}

export interface ServingGap {
  ingredient: Ingredient;
  /** Códigos das medidas com que o ingrediente é usado (ex.: "unit", "fatia"). */
  units: string[];
}

export interface MealGap {
  meal: Meal;
  missingCount: number;
}

export interface DataGaps {
  ingredientsNoNutrition: Ingredient[];
  ingredientsNoServing: ServingGap[];
  recipeGaps: RecipeGap[];
  mealGaps: MealGap[];
  /** Itens de comida na dispensa sem data de validade. */
  pantryNoExpiry: PantryItem[];
  total: number;
}

/** A medida precisa da porção padrão (g) para virar gramas? */
export function unitNeedsServing(unit: string | null | undefined): boolean {
  return !!unit && unit !== 'g' && unit !== 'ml' && unit !== 'a_gosto';
}

/** Item sem quantidade utilizável (ignora "a gosto", que é intencional). */
function missingQuantity(item: { quantity: number | null; unit: string | null }): boolean {
  if (item.unit === 'a_gosto') return false;
  return item.quantity == null || !item.unit;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'pt-BR');

export function collectDataGaps(
  ingredients: Ingredient[],
  recipes: Recipe[],
  meals: Meal[],
  pantry: PantryItem[],
): DataGaps {
  // Quais ingredientes são usados com uma medida que exige porção padrão, e
  // com quais medidas (para dar contexto à estimativa da porção).
  const usedWithServingUnit = new Map<string, Set<string>>();
  const addUnit = (id: string, unit: string) => {
    const set = usedWithServingUnit.get(id) ?? new Set<string>();
    set.add(unit);
    usedWithServingUnit.set(id, set);
  };
  for (const meal of meals) {
    for (const item of meal.items) {
      if (item.kind === 'ingredient' && item.ingredient_id && unitNeedsServing(item.unit)) {
        addUnit(item.ingredient_id, item.unit as string);
      }
    }
  }
  for (const recipe of recipes) {
    for (const item of [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])]) {
      if (item.ingredient_id && unitNeedsServing(item.unit)) {
        addUnit(item.ingredient_id, item.unit as string);
      }
    }
  }

  const ingredientsNoNutrition = ingredients.filter((i) => !i.nutrition_per_100).sort(byName);
  const ingredientsNoServing: ServingGap[] = ingredients
    .filter((i) => (i.serving_size_g == null || i.serving_size_g <= 0) && usedWithServingUnit.has(i.id))
    .sort(byName)
    .map((ingredient) => ({
      ingredient,
      units: [...(usedWithServingUnit.get(ingredient.id) ?? [])],
    }));

  const recipeGaps: RecipeGap[] = [];
  for (const recipe of recipes) {
    const items = [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])];
    const missingCount = items.filter((it) => it.ingredient_id && missingQuantity(it)).length;
    if (missingCount > 0) recipeGaps.push({ recipe, missingCount });
  }
  recipeGaps.sort((a, b) => byName(a.recipe, b.recipe));

  const mealGaps: MealGap[] = [];
  for (const meal of meals) {
    const missingCount = meal.items.filter(
      (it) => (it.ingredient_id || it.recipe_id) && missingQuantity(it),
    ).length;
    if (missingCount > 0) mealGaps.push({ meal, missingCount });
  }
  mealGaps.sort((a, b) => byName(a.meal, b.meal));

  // Itens de comida na dispensa sem data de validade (e não marcados como "sem validade").
  const pantryNoExpiry = pantry
    .filter((p) => p.kind !== 'household' && !p.expiry_date && !p.no_expiry)
    .sort((a, b) => a.raw_text.localeCompare(b.raw_text, 'pt-BR'));

  const total =
    ingredientsNoNutrition.length +
    ingredientsNoServing.length +
    recipeGaps.length +
    mealGaps.length +
    pantryNoExpiry.length;

  return {
    ingredientsNoNutrition,
    ingredientsNoServing,
    recipeGaps,
    mealGaps,
    pantryNoExpiry,
    total,
  };
}
