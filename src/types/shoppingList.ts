export type ShoppingSource = 'manual' | 'from_recipe' | 'from_pantry';

/**
 * Tipo do item: 'food' (comida, ligado a um ingrediente) ou 'household'
 * (itens de casa/recorrentes que NÃO são comida — papel higiênico, higiene,
 * papelaria). Itens 'household' nunca criam ingrediente, então não aparecem
 * nas telas de comida (Receitas, Refeições, Plano, Ingredientes).
 * `undefined` é tratado como 'food' para retrocompatibilidade.
 */
export type ItemKind = 'food' | 'household';

export interface ShoppingItem {
  id: string;
  ingredient_id: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  /** @deprecated usar `stores`. Mantido para compatibilidade com itens antigos. */
  store?: string | null;
  /** Mercados/lojas onde o item pode ser comprado (um item pode estar em vários). */
  stores?: string[];
  price: number | null;
  checked: boolean;
  source: ShoppingSource;
  source_ref?: string;
  added_at: string;
  expiry_date?: string | null;
  kind?: ItemKind;
}

/** Lê os mercados de um item, com fallback para o campo legado `store`. */
export function itemStores(item: { store?: string | null; stores?: string[] }): string[] {
  if (item.stores && item.stores.length > 0) return item.stores;
  return item.store ? [item.store] : [];
}
