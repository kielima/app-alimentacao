import { httpsCallable, type FunctionsError } from 'firebase/functions';
import { functions, firebaseConfigured } from './firebase';
import type { NutritionPer100 } from '../types/ingredient';

// A leitura por foto agora passa por uma Cloud Function (extractNutrition) que
// guarda a chave do Gemini no servidor — nada de chave no bundle do cliente.
// O recurso fica disponível sempre que o Firebase estiver configurado.
export const geminiConfigured = firebaseConfigured;

/** Campos extras reconhecidos pelo modelo, com a unidade esperada. */
const EXTRA_FIELDS = [
  'trans_fat_g',
  'cholesterol_mg',
  'calcium_mg',
  'iron_mg',
  'potassium_mg',
] as const;

/** Resultado bruto devolvido pela função (antes de normalizar para 100 g/ml). */
interface GeminiNutritionRaw {
  basis: 'per_100g' | 'per_100ml' | 'per_serving' | 'unknown';
  unit: 'g' | 'ml';
  serving_size: number | null;
  serving_description: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  sugars: number | null;
  fat: number | null;
  saturated_fat: number | null;
  fiber: number | null;
  sodium: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  found: boolean;
  notes: string | null;
}

/** Dados já normalizados por 100 g/ml, prontos para revisão e gravação. */
export interface ExtractedNutrition {
  /** true se a tabela foi reconhecida e há ao menos um macro. */
  found: boolean;
  /** 'g' ou 'ml' — base da unidade detectada no rótulo. */
  unit: 'g' | 'ml';
  /** Como os valores originais estavam no rótulo (para mostrar na revisão). */
  basis: GeminiNutritionRaw['basis'];
  /** Os valores foram convertidos a partir da porção (pode ter imprecisão). */
  normalizedFromServing: boolean;
  servingSizeG: number | null;
  servingDescription: string | null;
  nutrition: NutritionPer100;
  extras: Record<string, number>;
  notes: string | null;
}

/** Lê um File de imagem como base64 puro (sem o prefixo data:). */
function rawFileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

/** Carrega o arquivo como imagem desenhável, respeitando a orientação EXIF. */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // alguns formatos (ex.: HEIC) podem falhar aqui — cai no fallback abaixo
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem.'));
    };
    img.src = url;
  });
}

/**
 * Redimensiona e recomprime a imagem (JPEG) antes de enviar: fotos da galeria em
 * alta resolução viram um base64 grande demais para a função/callable e falham
 * o upload. ~1600px no maior lado mantém a tabela legível. Cai para o arquivo
 * original se o canvas falhar (ex.: formato não decodificável).
 */
async function fileToBase64(
  file: File,
  maxDim = 1600,
  quality = 0.8,
): Promise<{ base64: string; mimeType: string }> {
  try {
    const img = await loadImage(file);
    const w0 = (img as HTMLImageElement).naturalWidth || img.width;
    const h0 = (img as HTMLImageElement).naturalHeight || img.height;
    if (!w0 || !h0) throw new Error('sem dimensões');

    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sem contexto 2d');
    ctx.drawImage(img, 0, 0, w, h);
    if ('close' in img && typeof img.close === 'function') img.close();

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
    if (!base64) throw new Error('canvas vazio');
    return { base64, mimeType: 'image/jpeg' };
  } catch {
    // Fallback: envia o arquivo original sem redimensionar.
    return rawFileToBase64(file);
  }
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza o resultado bruto para valores por 100 g/ml.
 * Quando a base é "por porção", converte usando o tamanho da porção.
 */
function normalize(raw: GeminiNutritionRaw): ExtractedNutrition {
  const unit: 'g' | 'ml' = raw.unit === 'ml' ? 'ml' : 'g';
  const servingSize = num(raw.serving_size);

  const needsConversion = raw.basis === 'per_serving' && !!servingSize && servingSize > 0;
  const factor = needsConversion ? 100 / (servingSize as number) : 1;

  const scale = (v: number | null): number | null =>
    v === null ? null : round(v * factor);

  const nutrition: NutritionPer100 = {
    calories: scale(num(raw.calories)) ?? 0,
    protein: scale(num(raw.protein)) ?? 0,
    carbs: scale(num(raw.carbs)) ?? 0,
    sugars: scale(num(raw.sugars)),
    fat: scale(num(raw.fat)) ?? 0,
    saturated_fat: scale(num(raw.saturated_fat)),
    fiber: scale(num(raw.fiber)),
    sodium: scale(num(raw.sodium)),
  };

  const extras: Record<string, number> = {};
  for (const key of EXTRA_FIELDS) {
    const scaled = scale(num(raw[key]));
    if (scaled !== null) extras[key] = scaled;
  }

  return {
    found: Boolean(raw.found),
    unit,
    basis: raw.basis ?? 'unknown',
    normalizedFromServing: needsConversion,
    servingSizeG: servingSize,
    servingDescription: raw.serving_description?.trim() || null,
    nutrition,
    extras,
    notes: raw.notes?.trim() || null,
  };
}

/** Traduz erros da Cloud Function para mensagens amigáveis. */
function friendlyError(err: unknown): string {
  const fe = err as Partial<FunctionsError> & { message?: string };
  switch (fe?.code) {
    case 'functions/unauthenticated':
      return 'Faça login para usar a leitura por foto.';
    case 'functions/permission-denied':
      return 'Sua conta não tem permissão para usar este recurso.';
    case 'functions/resource-exhausted':
      return 'Limite de uso do Gemini atingido. Tente novamente mais tarde.';
    case 'functions/failed-precondition':
      return 'Servidor sem chave do Gemini configurada. Verifique o secret GEMINI_API_KEY.';
    case 'functions/unavailable':
      return 'Falha de rede ao consultar o Gemini. Tente novamente.';
    case 'functions/invalid-argument':
      return fe.message || 'Imagem inválida. Tente outra foto.';
    default:
      return fe?.message || 'Falha ao ler a imagem. Tente novamente.';
  }
}

/**
 * Envia uma foto de tabela nutricional à Cloud Function e devolve os valores
 * extraídos, já normalizados por 100 g/ml. Lança Error amigável em caso de falha.
 */
export async function extractNutritionFromImage(file: File): Promise<ExtractedNutrition> {
  if (!functions) {
    throw new Error('Firebase não configurado.');
  }

  const { base64, mimeType } = await fileToBase64(file);
  const callable = httpsCallable<{ imageBase64: string; mimeType: string }, GeminiNutritionRaw>(
    functions,
    'extractNutrition',
  );

  let raw: GeminiNutritionRaw;
  try {
    const resp = await callable({ imageBase64: base64, mimeType });
    raw = resp.data;
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  return normalize(raw);
}

/**
 * Estima a tabela nutricional a partir do NOME do ingrediente (sem foto), via
 * Cloud Function `estimateNutritionByName`. Devolve os valores já normalizados
 * por 100 g/ml. São ESTIMATIVAS da IA — devem ser revisadas antes de salvar.
 */
export async function estimateNutritionByName(
  name: string,
  brand: string | null | undefined,
  unit: 'g' | 'ml',
): Promise<ExtractedNutrition> {
  if (!functions) {
    throw new Error('Firebase não configurado.');
  }

  const callable = httpsCallable<
    { name: string; brand: string; unit: 'g' | 'ml' },
    GeminiNutritionRaw
  >(functions, 'estimateNutritionByName');

  let raw: GeminiNutritionRaw;
  try {
    const resp = await callable({ name, brand: brand ?? '', unit });
    raw = resp.data;
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  return normalize(raw);
}

/** Resultado bruto da função `estimateServingSize` (peso de 1 medida). */
interface GeminiServingRaw {
  found: boolean;
  grams: number | null;
  measure_label: string | null;
  notes: string | null;
}

/** Estimativa de porção padrão (gramas de 1 medida), já validada. */
export interface ServingEstimate {
  /** true quando há um peso positivo utilizável. */
  found: boolean;
  /** Peso em gramas de 1 medida (null se a IA não soube estimar). */
  grams: number | null;
  /** Medida que a IA considerou (ex.: "1 unidade", "1 fatia"). */
  measureLabel: string | null;
  notes: string | null;
}

/**
 * Estima a PORÇÃO PADRÃO (gramas de 1 medida caseira) de um ingrediente a
 * partir do nome e das medidas com que ele é usado (unidade, fatia, colher…),
 * via Cloud Function `estimateServingSize`. É ESTIMATIVA — deve ser revisada
 * antes de salvar.
 */
export async function estimateServingSize(
  name: string,
  brand: string | null | undefined,
  measures: string[],
): Promise<ServingEstimate> {
  if (!functions) {
    throw new Error('Firebase não configurado.');
  }

  const callable = httpsCallable<
    { name: string; brand: string; measures: string[] },
    GeminiServingRaw
  >(functions, 'estimateServingSize');

  let raw: GeminiServingRaw;
  try {
    const resp = await callable({ name, brand: brand ?? '', measures });
    raw = resp.data;
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  const grams = num(raw.grams);
  const valid = Boolean(raw.found) && grams !== null && grams > 0;
  return {
    found: valid,
    grams: valid ? round(grams as number, 1) : null,
    measureLabel: raw.measure_label?.trim() || null,
    notes: raw.notes?.trim() || null,
  };
}
