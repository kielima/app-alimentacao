const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

// Chave do Google AI Studio guardada no Google Secret Manager — NUNCA vai para o
// cliente. Crie com: firebase functions:secrets:set GEMINI_API_KEY
// (ou pelo Console → Secret Manager, segredo de nome GEMINI_API_KEY).
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Token da Apify (opcional) — só é necessário para importar receitas de TikTok e
// Instagram, que bloqueiam acesso direto. Crie o secret com o nome APIFY_API_TOKEN.
// Sem ele, YouTube, páginas web e o modo "colar texto" continuam funcionando.
const APIFY_API_TOKEN = defineSecret('APIFY_API_TOKEN');

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

// ---------------------------------------------------------------------------
// Importar receita de um link (TikTok / Instagram / YouTube / página web).
// Mesma ideia do extractNutrition: a chave fica no servidor e a saída é forçada
// por JSON Schema. YouTube e páginas web não precisam de terceiros; TikTok e
// Instagram passam por um scraper (Apify) porque bloqueiam acesso direto.
// ---------------------------------------------------------------------------

// Actors da Apify (configuráveis por env var). Devolvem legenda + transcrição.
const APIFY_TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || 'clockworks~tiktok-scraper';
const APIFY_INSTAGRAM_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

const RECIPE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    name: { type: 'string', nullable: true },
    category: {
      type: 'string',
      enum: [
        'pratos-principais',
        'bebidas',
        'sobremesas-e-lanches',
        'molhos-temperos-acompanhamentos',
      ],
      nullable: true,
    },
    prep_time_min: { type: 'number', nullable: true },
    difficulty: { type: 'string', enum: ['facil', 'medio', 'dificil'], nullable: true },
    servings: { type: 'number', nullable: true },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_text: { type: 'string' },
          name: { type: 'string', nullable: true },
          quantity: { type: 'number', nullable: true },
          unit: { type: 'string', nullable: true },
        },
        required: ['raw_text'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', nullable: true },
    image_url: { type: 'string', nullable: true },
    source_platform: { type: 'string', nullable: true },
    language: { type: 'string', nullable: true },
  },
  required: ['found'],
};

const RECIPE_PROMPT = `Você é um assistente que extrai receitas de culinária de conteúdo da internet
(vídeos, legendas de redes sociais, transcrições de áudio ou páginas web) e responde APENAS com o
JSON definido pelo schema.

Regras importantes:
- Extraia o nome da receita, a lista de ingredientes e o modo de preparo (passos).
- Para cada ingrediente, preencha "raw_text" com a linha original legível (ex.: "2 xícaras de farinha de trigo").
  Quando conseguir, separe também "quantity" (número), "unit" (ex.: g, ml, xícara, colher de sopa, unidade)
  e "name" (só o nome do ingrediente, sem quantidade).
- "steps" é um array de passos curtos, na ordem de preparo. Não numere os passos no texto.
- Escolha a "category" que melhor descreve a receita entre as opções do schema.
- "prep_time_min" é o tempo total em minutos, se mencionado. "servings" é o rendimento (porções), se mencionado.
- Use ponto como separador decimal. Não invente valores nem ingredientes que não aparecem no conteúdo.
- Se o conteúdo NÃO contiver uma receita de culinária identificável, retorne found = false e deixe os demais campos vazios.
- Responda no mesmo idioma do conteúdo (normalmente português).`;

/** Detecta a plataforma a partir do host da URL. */
function detectPlatform(url) {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_) {
    return 'web';
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return 'youtube';
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  return 'web';
}

/** fetch com timeout via AbortController (ms). Lança em erro de rede. */
async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Chama o Gemini (texto e/ou vídeo por URL) e devolve o objeto JSON já parseado. */
async function geminiExtractRecipe(apiKey, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RECIPE_RESPONSE_SCHEMA,
    },
  };

  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      110000,
    );
  } catch (err) {
    logger.error('Falha de rede ao chamar o Gemini (receita)', err);
    throw new HttpsError('unavailable', 'Falha ao consultar o Gemini. Tente novamente.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson && errJson.error && errJson.error.message ? errJson.error.message : '';
    } catch (_) {
      // sem corpo legível
    }
    logger.error('Gemini retornou erro (receita)', { status: res.status, detail });
    if (res.status === 429) {
      throw new HttpsError('resource-exhausted', 'Limite de uso do Gemini atingido. Tente mais tarde.');
    }
    if (res.status === 400 || res.status === 403) {
      throw new HttpsError('failed-precondition', 'Chave do Gemini inválida ou sem permissão.');
    }
    throw new HttpsError('internal', `Gemini: HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.promptFeedback && json.promptFeedback.blockReason) {
    throw new HttpsError('invalid-argument', 'O Gemini bloqueou o conteúdo.');
  }
  const cand = json.candidates && json.candidates[0];
  const parts2 = cand && cand.content && cand.content.parts;
  const text = Array.isArray(parts2) ? parts2.map((p) => p.text || '').join('') : '';
  if (!text.trim()) {
    throw new HttpsError('internal', 'O Gemini não retornou dados. Tente novamente.');
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new HttpsError('internal', 'Resposta do Gemini em formato inesperado.');
  }
}

const MAX_TEXT_CHARS = 40000; // corta páginas/transcrições muito longas antes do Gemini.

/** Extrai o primeiro objeto/array JSON-LD com @type Recipe de um HTML. */
function extractRecipeJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch (_) {
      continue;
    }
    const found = findRecipeNode(data);
    if (found) return found;
  }
  return null;
}

/** Percorre o JSON-LD procurando um nó cujo @type inclua "Recipe". */
function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const type = node['@type'];
  const isRecipe = Array.isArray(type)
    ? type.some((t) => String(t).toLowerCase() === 'recipe')
    : String(type || '').toLowerCase() === 'recipe';
  if (isRecipe) return node;
  if (Array.isArray(node['@graph'])) return findRecipeNode(node['@graph']);
  return null;
}

/** Converte um nó JSON-LD schema.org/Recipe no formato de saída da função. */
function jsonLdToRecipe(node, sourceUrl) {
  const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const ingredients = asArray(node.recipeIngredient || node.ingredients)
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((raw_text) => ({ raw_text, name: null, quantity: null, unit: null }));
  const steps = flattenInstructions(node.recipeInstructions);
  const image = node.image;
  const image_url = Array.isArray(image)
    ? typeof image[0] === 'string'
      ? image[0]
      : image[0] && image[0].url
    : typeof image === 'string'
      ? image
      : image && image.url;
  return {
    found: ingredients.length > 0 || steps.length > 0,
    name: (node.name && String(node.name).trim()) || null,
    category: null, // deixamos o cliente/usuário escolher; JSON-LD raramente casa com nossas 4.
    prep_time_min: parseIsoDurationMin(node.totalTime || node.cookTime || node.prepTime),
    difficulty: null,
    servings: null,
    ingredients,
    steps,
    notes: null,
    image_url: image_url || null,
    source_platform: 'web',
    source_url: sourceUrl,
    via: 'json-ld',
  };
}

/** Achata recipeInstructions (string, array de strings, HowToStep, HowToSection). */
function flattenInstructions(instr) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') {
      x.split(/\n+/).forEach((line) => {
        const t = line.trim();
        if (t) out.push(t);
      });
    } else if (Array.isArray(x)) {
      x.forEach(walk);
    } else if (typeof x === 'object') {
      if (x['@type'] === 'HowToSection' && x.itemListElement) walk(x.itemListElement);
      else if (x.text) walk(x.text);
      else if (x.name) walk(x.name);
    }
  };
  walk(instr);
  return out;
}

/** "PT1H30M" → 90 (minutos). Retorna null se não parsear. */
function parseIsoDurationMin(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const total = h * 60 + min;
  return total > 0 ? total : null;
}

/** Remove tags/scripts e devolve texto legível (cortado em MAX_TEXT_CHARS). */
function htmlToText(html) {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = noScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, MAX_TEXT_CHARS);
}

/** Roda um actor da Apify de forma síncrona e devolve os itens do dataset. */
async function runApifyActor(actor, input, token) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token,
  )}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    100000,
  );
  if (!res.ok) {
    logger.error('Apify retornou erro', { status: res.status, actor });
    if (res.status === 401 || res.status === 403) {
      throw new HttpsError('failed-precondition', 'Token da Apify inválido ou sem permissão.');
    }
    throw new HttpsError('unavailable', `Apify: HTTP ${res.status}`);
  }
  const items = await res.json();
  return Array.isArray(items) ? items : [];
}

/** Junta legenda + transcrição de um post de TikTok/Instagram num bloco de texto. */
async function scrapeSocialCaption(platform, url, token) {
  if (!token) {
    throw new HttpsError(
      'failed-precondition',
      'Importar de TikTok/Instagram precisa do token da Apify (APIFY_API_TOKEN) configurado no servidor. ' +
        'Enquanto isso, use o modo "colar texto" com a legenda do post.',
    );
  }
  const isTikTok = platform === 'tiktok';
  const actor = isTikTok ? APIFY_TIKTOK_ACTOR : APIFY_INSTAGRAM_ACTOR;
  const input = isTikTok
    ? { postURLs: [url], shouldDownloadSubtitles: true, resultsPerPage: 1, shouldDownloadVideos: false }
    : { directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false };

  let items;
  try {
    items = await runApifyActor(actor, input, token);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Falha ao chamar a Apify', err);
    throw new HttpsError('unavailable', 'Falha ao ler o post. Tente novamente ou use "colar texto".');
  }

  const item = items[0];
  if (!item) {
    throw new HttpsError(
      'not-found',
      'Não consegui ler esse post (pode estar privado ou indisponível). Use "colar texto" com a legenda.',
    );
  }

  const caption = item.text || item.caption || item.title || item.description || '';
  const subtitles = extractSubtitleText(item);
  const parts = [];
  if (caption) parts.push(`Legenda do post:\n${caption}`);
  if (subtitles) parts.push(`Transcrição do áudio/legendas do vídeo:\n${subtitles}`);
  const combined = parts.join('\n\n').trim();
  if (!combined) {
    throw new HttpsError(
      'not-found',
      'O post não tinha legenda nem transcrição legível. Use "colar texto" com a receita.',
    );
  }
  const image_url =
    item.displayUrl || item.thumbnail || (Array.isArray(item.covers) ? item.covers[0] : null) || null;
  return { text: combined.slice(0, MAX_TEXT_CHARS), image_url };
}

/** Tenta extrair texto de legendas/subtitles de vários formatos que a Apify devolve. */
function extractSubtitleText(item) {
  const subs = item.subtitles || item.videoMeta?.subtitleLinks || item.transcripts;
  if (typeof subs === 'string') return subs;
  if (Array.isArray(subs)) {
    return subs
      .map((s) => (typeof s === 'string' ? s : s.text || s.content || ''))
      .filter(Boolean)
      .join(' ');
  }
  if (subs && typeof subs === 'object') return subs.text || subs.content || '';
  return '';
}

exports.extractRecipeFromUrl = onCall(
  {
    secrets: [GEMINI_API_KEY, APIFY_API_TOKEN],
    timeoutSeconds: 120,
    memory: '512MiB',
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

    // 2) Valida a entrada: url OU text.
    const data = request.data || {};
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    const pastedText = typeof data.text === 'string' ? data.text.trim() : '';
    if (!url && !pastedText) {
      throw new HttpsError('invalid-argument', 'Informe um link ou cole o texto da receita.');
    }

    const geminiKey = GEMINI_API_KEY.value();
    const apifyToken = (() => {
      try {
        return APIFY_API_TOKEN.value();
      } catch (_) {
        return '';
      }
    })();

    // 3a) Modo "colar texto": vai direto pro Gemini.
    if (!url) {
      const raw = await geminiExtractRecipe(geminiKey, [
        { text: RECIPE_PROMPT },
        { text: `Conteúdo colado pelo usuário:\n${pastedText.slice(0, MAX_TEXT_CHARS)}` },
      ]);
      return { ...raw, source_platform: 'text', source_url: null };
    }

    const platform = detectPlatform(url);

    // 3b) YouTube: o Gemini lê a URL do vídeo nativamente.
    if (platform === 'youtube') {
      const raw = await geminiExtractRecipe(geminiKey, [
        { text: RECIPE_PROMPT },
        { text: `Extraia a receita deste vídeo do YouTube: ${url}` },
        { fileData: { fileUri: url, mimeType: 'video/*' } },
      ]);
      return { ...raw, source_platform: 'youtube', source_url: url };
    }

    // 3c) TikTok / Instagram: scraping (Apify) → legenda+transcrição → Gemini.
    if (platform === 'tiktok' || platform === 'instagram') {
      const { text, image_url } = await scrapeSocialCaption(platform, url, apifyToken);
      const raw = await geminiExtractRecipe(geminiKey, [
        { text: RECIPE_PROMPT },
        { text: `Conteúdo extraído de um post de ${platform}:\n${text}` },
      ]);
      return {
        ...raw,
        image_url: raw.image_url || image_url || null,
        source_platform: platform,
        source_url: url,
      };
    }

    // 3d) Página web: tenta JSON-LD (schema.org/Recipe); se não houver, texto → Gemini.
    let html = '';
    try {
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; AppAlimentacaoBot/1.0; +https://app-alimentacao)',
            Accept: 'text/html,application/xhtml+xml',
          },
        },
        20000,
      );
      if (!res.ok) {
        throw new HttpsError('unavailable', `Não consegui abrir a página (HTTP ${res.status}).`);
      }
      html = await res.text();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('Falha ao buscar a página web', err);
      throw new HttpsError('unavailable', 'Falha ao abrir a página. Verifique o link.');
    }

    const jsonLd = extractRecipeJsonLd(html);
    if (jsonLd) {
      const mapped = jsonLdToRecipe(jsonLd, url);
      if (mapped.found) return mapped;
    }

    const pageText = htmlToText(html);
    if (!pageText) {
      throw new HttpsError('not-found', 'A página não tinha texto legível. Tente "colar texto".');
    }
    const raw = await geminiExtractRecipe(geminiKey, [
      { text: RECIPE_PROMPT },
      { text: `Conteúdo da página ${url}:\n${pageText}` },
    ]);
    return { ...raw, source_platform: 'web', source_url: url };
  },
);
