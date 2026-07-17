import { useEffect } from 'react';
import { createFirestoreStore } from '../utils/createFirestoreStore';
import {
  useUserIngredients,
  upsertUserIngredient,
  isUserIngredientsHydrated,
} from '../data/userIngredients';
import { upsertHouseholdItem } from '../data/householdItems';
import type { Ingredient } from '../types/ingredient';
import type { HouseholdItem } from '../types/household';
import type { DispensaStatus } from '../types/dispensaStatus';

/** Formato legado de `PantryItem` (coleção `pantry`, aposentada por este módulo). */
export interface LegacyPantryItem {
  id: string;
  ingredient_id: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  no_expiry?: boolean;
  store: string | null;
  added_at: string;
  notes?: string;
  kind?: 'food' | 'household';
}

/** Formato legado de `ShoppingItem` (coleção `shoppingList`, aposentada por este módulo). */
export interface LegacyShoppingItem {
  id: string;
  ingredient_id: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  store?: string | null;
  stores?: string[];
  price: number | null;
  checked: boolean;
  source: string;
  source_ref?: string;
  added_at: string;
  expiry_date?: string | null;
  kind?: 'food' | 'household';
}

function legacyStores(item: { store?: string | null; stores?: string[] }): string[] {
  if (item.stores && item.stores.length > 0) return item.stores;
  return item.store ? [item.store] : [];
}

export interface LegacyMigrationResult {
  updatedIngredients: Ingredient[];
  householdItems: HouseholdItem[];
}

/**
 * Migração pura (sem I/O): dado o catálogo de ingredientes atual e os itens
 * legados de `pantry`/`shoppingList`, devolve os ingredientes que precisam
 * ganhar `status` e os novos `HouseholdItem`s equivalentes aos itens de casa.
 * Idempotente: ingredientes que já têm `status` são ignorados.
 *
 * Em caso de conflito (mesmo ingrediente em `pantry` E `shoppingList`), a
 * dispensa vence — mantém os dados da posse física, mas ambos os docs
 * antigos são descartados pelo chamador de qualquer forma.
 */
export function migrateLegacyDispensaData(
  ingredients: Ingredient[],
  pantryItems: LegacyPantryItem[],
  shoppingItems: LegacyShoppingItem[],
): LegacyMigrationResult {
  const pantryByIngredient = new Map<string, LegacyPantryItem>();
  const pantryHousehold: LegacyPantryItem[] = [];
  for (const p of pantryItems) {
    if (p.kind === 'household' || !p.ingredient_id) pantryHousehold.push(p);
    else pantryByIngredient.set(p.ingredient_id, p);
  }

  const shoppingByIngredient = new Map<string, LegacyShoppingItem>();
  const shoppingHousehold: LegacyShoppingItem[] = [];
  for (const s of shoppingItems) {
    if (s.kind === 'household' || !s.ingredient_id) shoppingHousehold.push(s);
    else shoppingByIngredient.set(s.ingredient_id, s);
  }

  const updatedIngredients: Ingredient[] = [];
  for (const ing of ingredients) {
    if (ing.status) continue;
    const pantryMatch = pantryByIngredient.get(ing.id);
    const shoppingMatch = shoppingByIngredient.get(ing.id);
    if (pantryMatch) {
      updatedIngredients.push({
        ...ing,
        status: 'dispensa',
        quantity: pantryMatch.quantity ?? null,
        stock_unit: pantryMatch.unit ?? null,
        expiry_date: pantryMatch.expiry_date ?? null,
        no_expiry: pantryMatch.no_expiry ?? false,
        stores: pantryMatch.store ? [pantryMatch.store] : [],
        notes: pantryMatch.notes ?? ing.notes,
      });
    } else if (shoppingMatch) {
      updatedIngredients.push({
        ...ing,
        status: 'comprar',
        quantity: shoppingMatch.quantity ?? null,
        stock_unit: shoppingMatch.unit ?? null,
        price: shoppingMatch.price ?? null,
        checked: shoppingMatch.checked ?? false,
        stores: legacyStores(shoppingMatch),
      });
    } else {
      updatedIngredients.push({ ...ing, status: 'backlog' });
    }
  }

  const householdItems: HouseholdItem[] = [
    ...pantryHousehold.map(
      (p): HouseholdItem => ({
        id: p.id,
        raw_text: p.raw_text,
        quantity: p.quantity,
        unit: p.unit,
        expiry_date: p.expiry_date,
        no_expiry: p.no_expiry ?? false,
        stores: p.store ? [p.store] : [],
        status: 'dispensa' as DispensaStatus,
        added_at: p.added_at,
        notes: p.notes,
        kind: 'household',
      }),
    ),
    ...shoppingHousehold.map(
      (s): HouseholdItem => ({
        id: s.id,
        raw_text: s.raw_text,
        quantity: s.quantity,
        unit: s.unit,
        expiry_date: s.expiry_date ?? null,
        stores: legacyStores(s),
        price: s.price,
        checked: s.checked,
        status: 'comprar' as DispensaStatus,
        added_at: s.added_at,
        kind: 'household',
      }),
    ),
  ];

  return { updatedIngredients, householdItems };
}

// Stores legados, mantidos só para a migração ler/esvaziar `pantry` e
// `shoppingList` uma vez — não são mais re-exportados/usados no resto do app.
const legacyPantryStore = createFirestoreStore<LegacyPantryItem>('app-alimentacao:pantry', 'pantry');
const legacyShoppingStore = createFirestoreStore<LegacyShoppingItem>(
  'app-alimentacao:shopping-list',
  'shoppingList',
);

/**
 * Roda a migração assim que ingredientes + as duas coleções legadas estiverem
 * hidratadas, sempre que `pantry`/`shoppingList` (do usuário atual) tiverem
 * algo pra migrar. Grava os ingredientes/itens de casa atualizados e esvazia
 * as duas coleções — a partir daí vira no-op (idempotente), inclusive se o
 * usuário trocar de conta (não usa nenhuma flag "já rodei" fora do estado das
 * próprias coleções, então funciona de novo para uma conta diferente que
 * ainda tenha dados a migrar). Chame no nível do App, para um usuário
 * autenticado e aprovado.
 */
export function useDispensaMigration(): void {
  const ingredients = useUserIngredients();
  const pantryItems = legacyPantryStore.useAll();
  const shoppingItems = legacyShoppingStore.useAll();

  useEffect(() => {
    if (
      !isUserIngredientsHydrated() ||
      !legacyPantryStore.isHydrated() ||
      !legacyShoppingStore.isHydrated()
    ) {
      return;
    }
    // Nada a migrar: ou já rodou antes (coleções vazias), ou o usuário nunca
    // teve dados nelas. Ingredientes sem `status` seguem tratados como
    // 'backlog' pelo fallback de leitura (`ingredientStatus`), sem precisar
    // gravar o campo explicitamente aqui.
    if (pantryItems.length === 0 && shoppingItems.length === 0) return;

    const { updatedIngredients, householdItems } = migrateLegacyDispensaData(
      ingredients,
      pantryItems,
      shoppingItems,
    );
    for (const ing of updatedIngredients) upsertUserIngredient(ing);
    for (const item of householdItems) upsertHouseholdItem(item);
    legacyPantryStore.replace([]);
    legacyShoppingStore.replace([]);
  }, [ingredients, pantryItems, shoppingItems]);
}
