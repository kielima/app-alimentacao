export type ShoppingSource = 'manual' | 'from_recipe' | 'from_pantry';

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
}
