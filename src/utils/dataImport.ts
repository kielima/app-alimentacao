import { setUserProfile } from '../data/userProfile';
import {
  getUserRecipes,
  upsertUserRecipe,
  replaceUserRecipes,
} from '../data/userRecipes';
import { getUserMeals, upsertUserMeal, replaceUserMeals } from '../data/userMeals';
import {
  getUserIngredients,
  upsertUserIngredient,
  replaceUserIngredients,
} from '../data/userIngredients';
import {
  getHouseholdItems,
  upsertHouseholdItem,
  replaceHouseholdItems,
} from '../data/householdItems';
import { getMarkets, upsertMarket, replaceMarkets } from '../data/markets';
import { getMealPlans, upsertMealPlan, replaceMealPlans } from '../data/mealPlan';
import {
  getOffContributions,
  upsertOffContribution,
  replaceOffContributions,
} from '../data/offContributions';
import {
  getHiddenIngredients,
  upsertHiddenIngredient,
  replaceHiddenIngredients,
} from '../data/hiddenIngredients';
import {
  getHiddenRecipes,
  upsertHiddenRecipe,
  replaceHiddenRecipes,
} from '../data/hiddenRecipes';
import { EXPORT_VERSION, type ExportPayload } from './dataExport';
import {
  migrateLegacyDispensaData,
  type LegacyPantryItem,
  type LegacyShoppingItem,
} from '../lib/dispensaMigration';
import type { Ingredient } from '../types/ingredient';
import type { HouseholdItem } from '../types/household';

export type ImportStrategy = 'replace' | 'upsert' | 'skip-existing';

export interface ImportResult {
  added: Record<string, number>;
  skipped: Record<string, number>;
  removed: Record<string, number>;
  profileImported: boolean;
}

const COLLECTION_KEYS = [
  'userRecipes',
  'userMeals',
  'userIngredients',
  'householdItems',
  'markets',
  'mealPlans',
  'offContributions',
  'hiddenIngredients',
  'hiddenRecipes',
] as const;

export async function parseImportFile(file: File): Promise<ExportPayload> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Arquivo não é um JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON inválido: esperado um objeto.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== 'app-alimentacao') {
    throw new Error('Esse JSON não é um backup do App de Alimentação.');
  }
  if (typeof obj.version !== 'number') {
    throw new Error('Backup sem campo "version".');
  }
  if (obj.version > EXPORT_VERSION) {
    throw new Error(
      `Backup é de uma versão mais nova (${obj.version}) do que esta instalação suporta (${EXPORT_VERSION}).`,
    );
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('Backup sem campo "data".');
  }
  return parsed as ExportPayload;
}

/**
 * Backups antigos (versão 1) ainda trazem `pantry`/`shoppingList` em vez de
 * `householdItems`, e os `userIngredients` deles não têm `status`. Faz o mesmo
 * papel de `dispensaMigration.ts`, mas sobre o payload do backup em vez das
 * coleções ao vivo do Firestore — mescla o resultado de volta em `payload.data`
 * antes de rodar os adapters normais.
 */
function migrateLegacyPayload(payload: ExportPayload): void {
  const raw = payload.data as unknown as Record<string, unknown>;
  const legacyPantry = raw.pantry as LegacyPantryItem[] | undefined;
  const legacyShopping = raw.shoppingList as LegacyShoppingItem[] | undefined;
  if ((!legacyPantry || legacyPantry.length === 0) && (!legacyShopping || legacyShopping.length === 0)) {
    return;
  }
  const ingredients = payload.data.userIngredients ?? [];
  const { updatedIngredients, householdItems } = migrateLegacyDispensaData(
    ingredients,
    legacyPantry ?? [],
    legacyShopping ?? [],
  );
  const byId = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  for (const updated of updatedIngredients) byId.set(updated.id, updated);
  payload.data.userIngredients = [...byId.values()];

  const householdById = new Map<string, HouseholdItem>(
    (payload.data.householdItems ?? []).map((i) => [i.id, i]),
  );
  for (const item of householdItems) householdById.set(item.id, item);
  payload.data.householdItems = [...householdById.values()];
}

export function importSummary(payload: ExportPayload): Record<string, number> {
  migrateLegacyPayload(payload);
  const d = payload.data;
  return {
    receitas: d.userRecipes?.length ?? 0,
    refeicoes: d.userMeals?.length ?? 0,
    ingredientes: d.userIngredients?.length ?? 0,
    itensDeCasa: d.householdItems?.length ?? 0,
    mercados: d.markets?.length ?? 0,
    plano: d.mealPlans?.length ?? 0,
    contribuicoesOff: d.offContributions?.length ?? 0,
    receitasOcultas: d.hiddenRecipes?.length ?? 0,
    ingredientesOcultos: d.hiddenIngredients?.length ?? 0,
    perfil: d.userProfile ? 1 : 0,
  };
}

interface CollectionAdapter<T extends { id: string }> {
  key: (typeof COLLECTION_KEYS)[number];
  getAll: () => T[];
  upsert: (item: T) => void;
  replace: (items: T[]) => void;
}

function adapters(): CollectionAdapter<{ id: string }>[] {
  return [
    {
      key: 'userRecipes',
      getAll: getUserRecipes,
      upsert: upsertUserRecipe as (item: { id: string }) => void,
      replace: replaceUserRecipes as (items: { id: string }[]) => void,
    },
    {
      key: 'userMeals',
      getAll: getUserMeals,
      upsert: upsertUserMeal as (item: { id: string }) => void,
      replace: replaceUserMeals as (items: { id: string }[]) => void,
    },
    {
      key: 'userIngredients',
      getAll: getUserIngredients,
      upsert: upsertUserIngredient as (item: { id: string }) => void,
      replace: replaceUserIngredients as (items: { id: string }[]) => void,
    },
    {
      key: 'householdItems',
      getAll: getHouseholdItems,
      upsert: upsertHouseholdItem as (item: { id: string }) => void,
      replace: replaceHouseholdItems as (items: { id: string }[]) => void,
    },
    {
      key: 'markets',
      getAll: getMarkets,
      upsert: upsertMarket as (item: { id: string }) => void,
      replace: replaceMarkets as (items: { id: string }[]) => void,
    },
    {
      key: 'mealPlans',
      getAll: getMealPlans,
      upsert: upsertMealPlan as (item: { id: string }) => void,
      replace: replaceMealPlans as (items: { id: string }[]) => void,
    },
    {
      key: 'offContributions',
      getAll: getOffContributions,
      upsert: upsertOffContribution as (item: { id: string }) => void,
      replace: replaceOffContributions as (items: { id: string }[]) => void,
    },
    {
      key: 'hiddenIngredients',
      getAll: getHiddenIngredients,
      upsert: (item) =>
        upsertHiddenIngredient(item as { id: string; hidden_at: string }),
      replace: (items) =>
        replaceHiddenIngredients(items as { id: string; hidden_at: string }[]),
    },
    {
      key: 'hiddenRecipes',
      getAll: getHiddenRecipes,
      upsert: (item) => upsertHiddenRecipe(item as { id: string; hidden_at: string }),
      replace: (items) =>
        replaceHiddenRecipes(items as { id: string; hidden_at: string }[]),
    },
  ];
}

export function importData(
  payload: ExportPayload,
  strategy: ImportStrategy,
): ImportResult {
  migrateLegacyPayload(payload);

  const result: ImportResult = {
    added: {},
    skipped: {},
    removed: {},
    profileImported: false,
  };

  for (const adapter of adapters()) {
    const incoming = (payload.data[adapter.key] ?? []) as { id: string }[];
    const existing = adapter.getAll();
    const existingIds = new Set(existing.map((it) => it.id));

    if (strategy === 'replace') {
      // Proteção: um backup que não inclui esta coleção (incoming vazio) NÃO
      // deve apagar os dados existentes. Quase sempre é um backup parcial, não
      // a intenção de esvaziar a coleção. Preserva o que já existe.
      if (incoming.length === 0 && existing.length > 0) {
        result.added[adapter.key] = 0;
        result.removed[adapter.key] = 0;
        result.skipped[adapter.key] = existing.length;
        continue;
      }
      adapter.replace(incoming);
      result.added[adapter.key] = incoming.length;
      result.removed[adapter.key] = existing.filter(
        (it) => !incoming.some((inc) => inc.id === it.id),
      ).length;
      continue;
    }

    let added = 0;
    let skipped = 0;
    for (const item of incoming) {
      const exists = existingIds.has(item.id);
      if (strategy === 'skip-existing' && exists) {
        skipped++;
        continue;
      }
      adapter.upsert(item);
      added++;
    }
    result.added[adapter.key] = added;
    result.skipped[adapter.key] = skipped;
  }

  if (payload.data.userProfile) {
    setUserProfile(payload.data.userProfile);
    result.profileImported = true;
  }

  return result;
}
