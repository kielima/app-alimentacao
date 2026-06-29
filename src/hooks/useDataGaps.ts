import { useMemo } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { useAllMeals } from '../data/meals';
import { useAllRecipes } from '../data/recipes';
import { collectDataGaps, type DataGaps } from '../utils/dataGaps';

export function useDataGaps(): DataGaps {
  const ingredients = useAllIngredients();
  const meals = useAllMeals();
  const recipes = useAllRecipes();
  return useMemo(
    () => collectDataGaps(ingredients, recipes, meals),
    [ingredients, recipes, meals],
  );
}
