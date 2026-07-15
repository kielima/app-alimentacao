import type { ExtractedNfce, ExtractedNfceItem, ExtractedNfceMarket } from './nfce';
import { normalizeNfceUnit } from './nfce';
import { normalize } from '../utils/search';
import { uniqueSlug } from '../utils/slug';
import { getMarkets, upsertMarket } from '../data/markets';
import { upsertShoppingItem } from '../data/shoppingList';
import { itemStores, type ShoppingItem } from '../types/shoppingList';
import type { Market } from '../types/market';

/** Uma linha da nota, já normalizada e pronta pra tela de revisão (tudo editável). */
export interface NfceReviewRow {
  key: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  /** Item da lista de compras que essa linha deve atualizar, ou `null` para criar um item novo. */
  targetId: string | null;
  include: boolean;
}

/** Casa a descrição de um item da nota com um item já existente na lista de compras
 *  (best-effort: igualdade normalizada, depois "contém" o mais curto que bate). */
export function matchNfceItem(
  item: ExtractedNfceItem,
  shoppingItems: ShoppingItem[],
): ShoppingItem | null {
  const key = normalize(item.description).trim();
  if (!key) return null;

  const exact = shoppingItems.find((s) => normalize(s.raw_text).trim() === key);
  if (exact) return exact;

  let best: ShoppingItem | null = null;
  let bestLen = Infinity;
  for (const s of shoppingItems) {
    const sKey = normalize(s.raw_text).trim();
    if (sKey.length < 3) continue;
    if ((key.includes(sKey) || sKey.includes(key)) && sKey.length < bestLen) {
      best = s;
      bestLen = sKey.length;
    }
  }
  return best;
}

/** Casa o mercado emissor da nota com um `Market` já cadastrado (por nome normalizado),
 *  ou cria um novo. Devolve `null` se a nota não trouxe nome de mercado. */
export function findOrCreateMarket(market: ExtractedNfceMarket | null): Market | null {
  if (!market?.name) return null;
  const existing = getMarkets();
  const key = normalize(market.name).trim();
  const found = existing.find((m) => normalize(m.name).trim() === key);
  if (found) return found;

  const ids = new Set(existing.map((m) => m.id));
  const created: Market = {
    id: uniqueSlug(market.name, ids),
    name: market.name,
    address: market.address ?? null,
    notes: market.cnpj ? `CNPJ: ${market.cnpj}` : null,
    ingredient_ids: [],
    added_at: new Date().toISOString(),
  };
  upsertMarket(created);
  return created;
}

/** Converte a saída da Cloud Function nas linhas editáveis da tela de revisão. */
export function buildNfceReviewRows(
  data: ExtractedNfce,
  shoppingItems: ShoppingItem[],
): NfceReviewRow[] {
  return data.items.map((item, idx) => {
    const { unit, quantity } = normalizeNfceUnit(item.unit, item.quantity);
    const match = matchNfceItem(item, shoppingItems);
    return {
      key: `${idx}-${item.description}`,
      description: item.description,
      quantity,
      unit,
      price: item.total_price,
      targetId: match?.id ?? null,
      include: true,
    };
  });
}

/** Aplica as linhas confirmadas: atualiza preço/unidade/quantidade dos itens casados
 *  e cria os marcados como "novo item"; vincula todos ao mercado emissor da nota. */
export function applyNfceReview(
  rows: NfceReviewRow[],
  shoppingItems: ShoppingItem[],
  market: ExtractedNfceMarket | null,
): void {
  const marketRecord = findOrCreateMarket(market);
  const storeName = marketRecord?.name ?? null;

  rows.forEach((row, idx) => {
    if (!row.include) return;

    if (row.targetId) {
      const target = shoppingItems.find((s) => s.id === row.targetId);
      if (!target) return;
      const stores = new Set(itemStores(target));
      if (storeName) stores.add(storeName);
      upsertShoppingItem({
        ...target,
        quantity: row.quantity,
        unit: row.unit,
        price: row.price,
        stores: [...stores],
      });
      return;
    }

    const description = row.description.trim();
    if (!description) return;
    upsertShoppingItem({
      id: `nfce-${Date.now()}-${idx}`,
      ingredient_id: null,
      raw_text: description,
      quantity: row.quantity,
      unit: row.unit,
      stores: storeName ? [storeName] : [],
      price: row.price,
      checked: false,
      source: 'manual',
      added_at: new Date().toISOString(),
    });
  });
}
