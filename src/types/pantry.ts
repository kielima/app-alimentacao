export interface PantryItem {
  id: string;
  ingredient_id: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  store: string | null;
  added_at: string;
  notes?: string;
}
