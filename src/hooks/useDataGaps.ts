import { useMemo } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { useAllMeals } from '../data/meals';
import { useAllRecipes } from '../data/recipes';
import { usePantryItems } from '../data/pantry';
import { collectDataGaps, type DataGaps } from '../utils/dataGaps';

export function useDataGaps(): DataGaps {
  const ingredients = useAllIngredients();
  const meals = useAllMeals();
  const recipes = useAllRecipes();
  const pantry = usePantryItems();
  return useMemo(
    () => collectDataGaps(ingredients, recipes, meals, pantry),
    [ingredients, recipes, meals, pantry],
  );
}
