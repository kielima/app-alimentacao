import type { NutritionPer100 } from '../types/ingredient';

// ── Configuração ────────────────────────────────────────────────────────────
// Chave do Google AI Studio (free tier). Vai para o bundle do cliente, igual às
// chaves do Firebase — ver .env.local.example. Sem chave, o recurso fica oculto.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

export const geminiConfigured = Boolean(API_KEY);

/** Campos extras que o modelo é instruído a reconhecer, com a unidade esperada. */
const EXTRA_FIELDS = [
  'trans_fat_g',
  'cholesterol_mg',
  'calcium_mg',
  'iron_mg',
  'potassium_mg',
] as const;

/** Resultado bruto que pedimos ao modelo (antes de normalizar para 100 g/ml). */
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

// JSON Schema enviado ao Gemini para forçar saída estruturada.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    found: {
      type: 'boolean',
      description: 'true se a imagem contém uma tabela nutricional legível',
    },
    basis: {
      type: 'string',
      enum: ['per_100g', 'per_100ml', 'per_serving', 'unknown'],
      description:
        'A que se referem os valores extraídos: por 100 g, por 100 ml, por porção, ou desconhecido',
    },
    unit: {
      type: 'string',
      enum: ['g', 'ml'],
      description: 'g para sólidos, ml para líquidos',
    },
    serving_size: {
      type: 'number',
      nullable: true,
      description: 'Tamanho da porção em g ou ml (apenas o número)',
    },
    serving_description: {
      type: 'string',
      nullable: true,
      description: 'Descrição da porção, ex.: "2 fatias", "1 copo (200 ml)"',
    },
    calories: { type: 'number', nullable: true, description: 'Valor energético em kcal' },
    protein: { type: 'number', nullable: true, description: 'Proteínas em g' },
    carbs: { type: 'number', nullable: true, description: 'Carboidratos em g' },
    sugars: { type: 'number', nullable: true, description: 'Açúcares totais em g' },
    fat: { type: 'number', nullable: true, description: 'Gorduras totais em g' },
    saturated_fat: { type: 'number', nullable: true, description: 'Gorduras saturadas em g' },
    fiber: { type: 'number', nullable: true, description: 'Fibra alimentar em g' },
    sodium: { type: 'number', nullable: true, description: 'Sódio em mg' },
    trans_fat_g: { type: 'number', nullable: true, description: 'Gorduras trans em g' },
    cholesterol_mg: { type: 'number', nullable: true, description: 'Colesterol em mg' },
    calcium_mg: { type: 'number', nullable: true, description: 'Cálcio em mg' },
    iron_mg: { type: 'number', nullable: true, description: 'Ferro em mg' },
    potassium_mg: { type: 'number', nullable: true, description: 'Potássio em mg' },
    notes: {
      type: 'string',
      nullable: true,
      description: 'Observações curtas se algo estiver ambíguo ou ilegível',
    },
  },
  required: ['found', 'basis', 'unit'],
} as const;

const PROMPT = `Você é um assistente que lê tabelas de informação nutricional de rótulos de alimentos (padrão brasileiro ANVISA e similares).

Extraia os valores nutricionais da imagem e responda APENAS com o JSON definido pelo schema.

Regras importantes:
- Se a tabela tiver uma coluna "por 100 g" ou "por 100 ml", use ESSA coluna e marque basis = "per_100g" ou "per_100ml".
- Se só houver valores "por porção", use-os e marque basis = "per_serving", preenchendo serving_size (número em g ou ml) e serving_description.
- "Valor energético" é em kcal (ignore o valor em kJ). Se só houver kJ, converta dividindo por 4,184.
- Sódio em mg. Se estiver em g, converta para mg.
- Use ponto como separador decimal. Não inclua unidades nos números, apenas o valor.
- Deixe null qualquer nutriente que não apareça no rótulo. NÃO invente valores.
- Se a imagem não tiver uma tabela nutricional legível, retorne found = false.`;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** Lê um File de imagem como base64 puro (sem o prefixo data:). */
function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
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
 * Normaliza o resultado bruto do modelo para valores por 100 g/ml.
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

/**
 * Envia uma foto de tabela nutricional ao Gemini e devolve os valores extraídos,
 * já normalizados por 100 g/ml. Lança Error com mensagem amigável em caso de falha.
 */
export async function extractNutritionFromImage(
  file: File,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ExtractedNutrition> {
  if (!API_KEY) {
    throw new Error('Chave do Gemini não configurada (VITE_GEMINI_API_KEY).');
  }

  const { base64, mimeType } = await fileToBase64(file);

  const timeout = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ] as GeminiPart[],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Tempo esgotado consultando o Gemini. Tente novamente.');
    }
    throw err instanceof Error ? err : new Error('Falha de rede ao consultar o Gemini.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message ? `: ${errJson.error.message}` : '';
    } catch {
      // sem corpo de erro legível
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error(`Chave do Gemini inválida ou sem permissão${detail}`);
    }
    if (res.status === 429) {
      throw new Error('Limite de uso do Gemini atingido. Tente novamente mais tarde.');
    }
    throw new Error(`Gemini: HTTP ${res.status}${detail}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error('O Gemini bloqueou a imagem. Tente outra foto.');
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new Error('O Gemini não retornou dados. Tente uma foto mais nítida.');
  }

  let raw: GeminiNutritionRaw;
  try {
    raw = JSON.parse(text) as GeminiNutritionRaw;
  } catch {
    throw new Error('Resposta do Gemini em formato inesperado. Tente novamente.');
  }

  return normalize(raw);
}
