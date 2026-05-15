import { useEffect, useState } from 'react';
import type { Recipe } from '../types/recipe';

const STORAGE_KEY = 'app-alimentacao:user-recipes';

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Recipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Recipe[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function getUserRecipes(): Recipe[] {
  return read();
}

export function getUserRecipeById(id: string): Recipe | undefined {
  return read().find((r) => r.id === id);
}

export function upsertUserRecipe(recipe: Recipe): void {
  const list = read();
  const idx = list.findIndex((r) => r.id === recipe.id);
  if (idx >= 0) list[idx] = recipe;
  else list.push(recipe);
  write(list);
}

export function deleteUserRecipe(id: string): void {
  write(read().filter((r) => r.id !== id));
}

export function useUserRecipes(): Recipe[] {
  const [recipes, setRecipes] = useState<Recipe[]>(read);
  useEffect(() => {
    const listener = () => setRecipes(read());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return recipes;
}
