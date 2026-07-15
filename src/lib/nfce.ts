import { httpsCallable, type FunctionsError } from 'firebase/functions';
import { functions, firebaseConfigured } from './firebase';
import { normalize } from '../utils/search';

// A leitura de nota fiscal (NFC-e) passa por uma Cloud Function (fetchNfce)
// que busca a página da SEFAZ no servidor e guarda a chave do Gemini lá —
// nada de chave no bundle do cliente. Disponível sempre que o Firebase
// estiver configurado (mesma condição de recipeImport.ts).
export const nfceConfigured = firebaseConfigured;

export interface ExtractedNfceMarket {
  name: string | null;
  cnpj: string | null;
  address: string | null;
}

export interface ExtractedNfceItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  total_price: number | null;
}

export interface ExtractedNfce {
  found: boolean;
  market: ExtractedNfceMarket | null;
  items: ExtractedNfceItem[];
}

type CallInput = { url: string };

/**
 * Detecta se o texto lido de um QR code parece a URL de consulta de uma
 * NFC-e brasileira: uma URL http(s) contendo a chave de acesso (44 dígitos
 * seguidos, normalmente no parâmetro `p=`) ou o caminho `nfce` — cobre os
 * portais dos diferentes estados sem depender de conhecer cada domínio.
 */
export function isNfceQrPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (/\d{44}/.test(trimmed)) return true;
  return /nfce/i.test(trimmed);
}

/** Traduz erros da Cloud Function para mensagens amigáveis. */
function friendlyError(err: unknown): string {
  const fe = err as Partial<FunctionsError> & { message?: string };
  switch (fe?.code) {
    case 'functions/unauthenticated':
      return 'Faça login para ler notas fiscais.';
    case 'functions/permission-denied':
      return 'Sua conta não tem permissão para usar este recurso.';
    case 'functions/resource-exhausted':
      return fe.message || 'Limite de uso atingido. Tente novamente mais tarde.';
    case 'functions/failed-precondition':
      return fe.message || 'Servidor sem as chaves necessárias configuradas.';
    case 'functions/unavailable':
      return fe.message || 'Falha de rede ao ler a nota. Tente novamente.';
    case 'functions/not-found':
      return fe.message || 'Não consegui ler os itens dessa nota.';
    case 'functions/invalid-argument':
      return fe.message || 'QR code inválido ou não é de uma nota fiscal.';
    default:
      return fe?.message || 'Falha ao ler a nota fiscal. Tente novamente.';
  }
}

/** Normaliza a saída bruta da função (defensivo: pode devolver campos nulos). */
function normalizeExtracted(raw: Partial<ExtractedNfce>): ExtractedNfce {
  const market =
    raw.market && typeof raw.market === 'object'
      ? {
          name: raw.market.name?.trim() || null,
          cnpj: raw.market.cnpj?.trim() || null,
          address: raw.market.address?.trim() || null,
        }
      : null;
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((i) => i && typeof i.description === 'string' && i.description.trim())
        .map((i) => ({
          description: i.description.trim(),
          quantity: typeof i.quantity === 'number' && Number.isFinite(i.quantity) ? i.quantity : null,
          unit: i.unit?.trim() || null,
          total_price:
            typeof i.total_price === 'number' && Number.isFinite(i.total_price)
              ? i.total_price
              : null,
        }))
    : [];
  return { found: Boolean(raw.found), market, items };
}

/**
 * Chama a Cloud Function para ler os itens de uma nota fiscal a partir da
 * URL lida do QR code. Lança Error com mensagem amigável em caso de falha.
 */
export async function fetchNfce(url: string): Promise<ExtractedNfce> {
  if (!functions) {
    throw new Error('Firebase não configurado.');
  }
  const callable = httpsCallable<CallInput, Partial<ExtractedNfce>>(functions, 'fetchNfce');
  try {
    const resp = await callable({ url });
    return normalizeExtracted(resp.data ?? { found: false, market: null, items: [] });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Abreviações de unidade comuns em notas fiscais → códigos de UNIT_OPTIONS (src/utils/units.ts). */
const NFCE_UNIT_ALIASES: Record<string, string> = {
  kg: 'g',
  g: 'g',
  gr: 'g',
  grama: 'g',
  gramas: 'g',
  l: 'ml',
  lt: 'ml',
  litro: 'ml',
  litros: 'ml',
  ml: 'ml',
  un: 'unit',
  und: 'unit',
  unid: 'unit',
  unidade: 'unit',
  unidades: 'unit',
  pc: 'unit',
  peca: 'unit',
  pecas: 'unit',
  cx: 'pct',
  pct: 'pct',
  pacote: 'pct',
  pacotes: 'pct',
  dz: 'pct',
  duzia: 'pct',
  mc: 'mç',
  maco: 'mç',
  macos: 'mç',
};

/** Unidades cujo valor numérico da nota vem em escala "grande" (kg, l) e precisa
 *  ser multiplicado por 1000 para virar a unidade "pequena" (g, ml) do app. */
const SCALE_1000_UNITS = new Set(['kg', 'l', 'lt', 'litro', 'litros']);

/**
 * Normaliza a unidade de uma linha de NFC-e para um código de UNIT_OPTIONS,
 * devolvendo também a quantidade já convertida para essa unidade (ex.: "0.5 KG"
 * vira quantity=500, unit='g'). Retorna unit=null quando não reconhece — o
 * texto original fica só na descrição e o usuário escolhe na revisão.
 */
export function normalizeNfceUnit(
  rawUnit: string | null,
  quantity: number | null,
): { unit: string | null; quantity: number | null } {
  if (!rawUnit) return { unit: null, quantity };
  const key = normalize(rawUnit).trim().replace(/\.$/, '');
  const unit = NFCE_UNIT_ALIASES[key] ?? null;
  if (!unit) return { unit: null, quantity };
  const scaled = SCALE_1000_UNITS.has(key) && quantity != null ? quantity * 1000 : quantity;
  return { unit, quantity: scaled };
}
