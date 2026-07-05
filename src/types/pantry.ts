import type { ItemKind } from './shoppingList';

export interface PantryItem {
  id: string;
  ingredient_id: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  /** Marcado explicitamente como um item que não vence (ex.: sal, produtos de limpeza). */
  no_expiry?: boolean;
  store: string | null;
  added_at: string;
  notes?: string;
  /** 'household' = item de casa/não-comida. undefined/'food' = comida. */
  kind?: ItemKind;
}
