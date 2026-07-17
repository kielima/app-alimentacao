import type { ExtractedNfce, ExtractedNfceItem, ExtractedNfceMarket } from './nfce';
import { normalizeNfceUnit } from './nfce';
import { normalize } from '../utils/search';
import { uniqueSlug } from '../utils/slug';
import { getMarkets, upsertMarket } from '../data/markets';
import { allIngredientIds } from '../data/ingredients';
import { upsertUserIngredient } from '../data/userIngredients';
import { upsertHouseholdItem } from '../data/householdItems';
import { itemDisplayName, type DispensaItem } from '../hooks/useDispensa';
import type { Market } from '../types/market';

/** Uma linha da nota, já normalizada e pronta pra tela de revisão (tudo editável). */
export interface NfceReviewRow {
  key: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  /** Chave (`${kind}:${id}`) do item de `status: 'comprar'` que essa linha deve
   *  atualizar, ou `null` para criar um ingrediente novo. */
  targetId: string | null;
  include: boolean;
}

function targetKey(item: DispensaItem): string {
  return `${item.kind}:${item.data.id}`;
}

/** Casa a descrição de um item da nota com um item já existente na lista de compras
 *  (best-effort: igualdade normalizada, depois "contém" o mais curto que bate). */
export function matchNfceItem(
  item: ExtractedNfceItem,
  comprarItems: DispensaItem[],
): DispensaItem | null {
  const key = normalize(item.description).trim();
  if (!key) return null;

  const exact = comprarItems.find((i) => normalize(itemDisplayName(i)).trim() === key);
  if (exact) return exact;

  let best: DispensaItem | null = null;
  let bestLen = Infinity;
  for (const i of comprarItems) {
    const iKey = normalize(itemDisplayName(i)).trim();
    if (iKey.length < 3) continue;
    if ((key.includes(iKey) || iKey.includes(key)) && iKey.length < bestLen) {
      best = i;
      bestLen = iKey.length;
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
  comprarItems: DispensaItem[],
): NfceReviewRow[] {
  return data.items.map((item, idx) => {
    const { unit, quantity } = normalizeNfceUnit(item.unit, item.quantity);
    const match = matchNfceItem(item, comprarItems);
    return {
      key: `${idx}-${item.description}`,
      description: item.description,
      quantity,
      unit,
      price: item.total_price,
      targetId: match ? targetKey(match) : null,
      include: true,
    };
  });
}

/** Aplica as linhas confirmadas: atualiza preço/unidade/quantidade dos itens casados
 *  (mantendo `status: 'comprar'`) e cria um ingrediente novo para os marcados como
 *  "novo item"; vincula todos ao mercado emissor da nota. */
export function applyNfceReview(
  rows: NfceReviewRow[],
  comprarItems: DispensaItem[],
  market: ExtractedNfceMarket | null,
): void {
  const marketRecord = findOrCreateMarket(market);
  const storeName = marketRecord?.name ?? null;

  rows.forEach((row) => {
    if (!row.include) return;

    if (row.targetId) {
      const target = comprarItems.find((i) => targetKey(i) === row.targetId);
      if (!target) return;
      const stores = new Set(target.data.stores ?? []);
      if (storeName) stores.add(storeName);
      if (target.kind === 'ingredient') {
        upsertUserIngredient({
          ...target.data,
          quantity: row.quantity,
          stock_unit: row.unit,
          price: row.price,
          stores: [...stores],
        });
      } else {
        upsertHouseholdItem({
          ...target.data,
          quantity: row.quantity,
          unit: row.unit,
          price: row.price,
          stores: [...stores],
        });
      }
      return;
    }

    const description = row.description.trim();
    if (!description) return;
    const fallbackUnit = row.unit === 'g' || row.unit === 'ml' || row.unit === 'unit' ? row.unit : 'g';
    const id = uniqueSlug(description, allIngredientIds());
    upsertUserIngredient({
      id,
      name: description,
      default_unit: fallbackUnit,
      nutrition_per_100: null,
      needs_review: true,
      status: 'comprar',
      quantity: row.quantity,
      stock_unit: row.unit,
      stores: storeName ? [storeName] : [],
      price: row.price,
      checked: false,
    });
  });
}
