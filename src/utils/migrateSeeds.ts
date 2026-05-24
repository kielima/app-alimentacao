import { collection, doc, writeBatch } from 'firebase/firestore';
import ingredientsSeed from '../../seed/ingredients.json';
import recipesSeed from '../../seed/recipes.json';
import mealsSeed from '../../seed/meals.json';
import type { Ingredient, IngredientsSeed } from '../types/ingredient';
import type { Recipe, RecipesSeed } from '../types/recipe';
import type { Meal, MealsSeed } from '../types/meal';
import { db, firebaseConfigured } from '../lib/firebase';

export interface MigrationProgress {
  collection: 'userIngredients' | 'recipes' | 'userMeals';
  total: number;
  written: number;
}

export interface MigrationResult {
  ingredients: number;
  recipes: number;
  meals: number;
}

// Firestore writeBatch suporta até 500 operações. 400 deixa folga.
const BATCH_SIZE = 400;

async function uploadCollection<T extends { id: string }>(
  uid: string,
  collectionName: MigrationProgress['collection'],
  items: T[],
  onProgress?: (p: MigrationProgress) => void,
): Promise<void> {
  if (!firebaseConfigured || !db) throw new Error('Firebase não configurado');
  const fsDb = db;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(fsDb);
    const col = collection(fsDb, 'users', uid, collectionName);
    for (const item of slice) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = item as T & { id: string };
      batch.set(doc(col, id), rest);
    }
    await batch.commit();
    onProgress?.({
      collection: collectionName,
      total: items.length,
      written: Math.min(i + BATCH_SIZE, items.length),
    });
  }
}

export function getSeedCounts(): MigrationResult {
  const ingredients = (ingredientsSeed as IngredientsSeed).ingredients;
  const recipes = (recipesSeed as unknown as RecipesSeed).recipes;
  const meals = (mealsSeed as unknown as MealsSeed).meals;
  return {
    ingredients: ingredients.length,
    recipes: recipes.length,
    meals: meals.length,
  };
}

/**
 * Copia os JSONs de seed/ para a conta do utilizador no Firestore, preservando
 * IDs (idempotente: re-correr sobrescreve com a versão do seed). Edições do
 * utilizador a docs com o mesmo ID são perdidas — confirmar antes de chamar.
 */
export async function migrateSeedsToUser(
  uid: string,
  onProgress?: (p: MigrationProgress) => void,
): Promise<MigrationResult> {
  const ingredients = (ingredientsSeed as IngredientsSeed).ingredients;
  const recipes = (recipesSeed as unknown as RecipesSeed).recipes;
  const meals = (mealsSeed as unknown as MealsSeed).meals;

  await uploadCollection<Ingredient>(uid, 'userIngredients', ingredients, onProgress);
  await uploadCollection<Recipe>(uid, 'recipes', recipes, onProgress);
  await uploadCollection<Meal>(uid, 'userMeals', meals, onProgress);

  return {
    ingredients: ingredients.length,
    recipes: recipes.length,
    meals: meals.length,
  };
}
