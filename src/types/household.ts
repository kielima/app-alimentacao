import type { DispensaStatus } from './dispensaStatus';

export interface HouseholdItem {
  id: string;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  /** Marcado explicitamente como um item que não vence (ex.: sal, produtos de limpeza). */
  no_expiry?: boolean;
  /** Mercados/lojas onde o item pode ser comprado (um item pode estar em vários). */
  stores?: string[];
  price?: number | null;
  /** Só relevante com `status: 'comprar'`: já foi comprado, pronto pra mover pra dispensa. */
  checked?: boolean;
  status: DispensaStatus;
  added_at: string;
  notes?: string;
  kind: 'household';
}
