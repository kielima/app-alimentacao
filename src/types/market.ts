export interface Market {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  ingredient_ids: string[];
  added_at: string;
}
