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
  store: string | null;
  price: number | null;
  checked: boolean;
  source: ShoppingSource;
  source_ref?: string;
  added_at: string;
  expiry_date?: string | null;
  kind?: ItemKind;
}
