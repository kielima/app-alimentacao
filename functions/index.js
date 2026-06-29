const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

// Chave do Google AI Studio guardada no Google Secret Manager — NUNCA vai para o
// cliente. Crie com: firebase functions:secrets:set GEMINI_API_KEY
// (ou pelo Console → Secret Manager, segredo de nome GEMINI_API_KEY).
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Só o dono do app pode usar (evita que terceiros gastem a quota do Gemini).
// Mantém igual ao ADMIN_EMAIL do cliente / às firestore.rules.
const ADMIN_EMAIL = 'kly@sapo.pt';

// Modelo de visão do free tier. Pode ser sobrescrito por variável de ambiente.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// JSON Schema que força a saída estruturada do Gemini.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    basis: { type: 'string', enum: ['per_100g', 'per_100ml', 'per_serving', 'unknown'] },
    unit: { type: 'string', enum: ['g', 'ml'] },
    serving_size: { type: 'number', nullable: true },
    serving_description: { type: 'string', nullable: true },
    calories: { type: 'number', nullable: true },
    protein: { type: 'number', nullable: true },
    carbs: { type: 'number', nullable: true },
    sugars: { type: 'number', nullable: true },
    fat: { type: 'number', nullable: true },
    saturated_fat: { type: 'number', nullable: true },
    fiber: { type: 'number', nullable: true },
    sodium: { type: 'number', nullable: true },
    trans_fat_g: { type: 'number', nullable: true },
    cholesterol_mg: { type: 'number', nullable: true },
    calcium_mg: { type: 'number', nullable: true },
    iron_mg: { type: 'number', nullable: true },
    potassium_mg: { type: 'number', nullable: true },
    notes: { type: 'string', nullable: true },
  },
  required: ['found', 'basis', 'unit'],
};

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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8 MB de base64 já é bem mais que uma foto.

exports.extractNutrition = onCall(
  {
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
    // Sem maxInstances alto: é uso pessoal e protege a quota.
    maxInstances: 3,
  },
  async (request) => {
    // 1) Exige login e restringe ao dono do app.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Faça login para usar este recurso.');
    }
    const email = request.auth.token && request.auth.token.email;
    if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      throw new HttpsError('permission-denied', 'Sem permissão para usar este recurso.');
    }

    // 2) Valida a imagem recebida.
    const data = request.data || {};
    const imageBase64 = data.imageBase64;
    const mimeType = typeof data.mimeType === 'string' ? data.mimeType : 'image/jpeg';
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      throw new HttpsError('invalid-argument', 'Imagem ausente ou inválida.');
    }
    if (imageBase64.length > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', 'Imagem muito grande. Use uma foto menor.');
    }

    // 3) Chama o Gemini com a chave do servidor.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY.value(),
    )}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: PROMPT }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      logger.error('Falha de rede ao chamar o Gemini', err);
      throw new HttpsError('unavailable', 'Falha ao consultar o Gemini. Tente novamente.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson && errJson.error && errJson.error.message ? errJson.error.message : '';
      } catch (_) {
        // sem corpo legível
      }
      logger.error('Gemini retornou erro', { status: res.status, detail });
      if (res.status === 429) {
        throw new HttpsError(
          'resource-exhausted',
          'Limite de uso do Gemini atingido. Tente mais tarde.',
        );
      }
      if (res.status === 400 || res.status === 403) {
        throw new HttpsError('failed-precondition', 'Chave do Gemini inválida ou sem permissão.');
      }
      throw new HttpsError('internal', `Gemini: HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.promptFeedback && json.promptFeedback.blockReason) {
      throw new HttpsError('invalid-argument', 'O Gemini bloqueou a imagem. Tente outra foto.');
    }

    const parts =
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts;
    const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
    if (!text.trim()) {
      throw new HttpsError('internal', 'O Gemini não retornou dados. Tente uma foto mais nítida.');
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (_) {
      throw new HttpsError('internal', 'Resposta do Gemini em formato inesperado.');
    }

    // 4) Devolve o objeto bruto; o cliente normaliza para 100 g/ml.
    return raw;
  },
);
