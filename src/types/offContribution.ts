export interface OffContributionDraft {
  id: string;
  barcode: string;
  product_name: string;
  brands?: string;
  ingredients_text?: string;
  allergens?: string;
  serving_size?: string;
  created_at: string;
  submitted_at?: string;
  note?: string;
}
