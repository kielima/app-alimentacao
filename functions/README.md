# Cloud Functions — proxy do Gemini

A função `extractNutrition` recebe a foto de uma tabela nutricional (base64),
chama o Google Gemini com a **chave guardada no servidor** e devolve os valores
extraídos. Assim a chave do Gemini **nunca vai para o bundle do cliente**.

- Só usuários logados com o e-mail do dono (`kly@sapo.pt`) podem chamar — isso
  protege a quota do Gemini contra abuso.
- O cliente chama via `httpsCallable(functions, 'extractNutrition')`
  (ver `src/lib/gemini.ts`).

## Estimativas por nome (sem foto)

Duas funções completam a tela "Dados a completar" a partir só do nome do
ingrediente (mesma proteção por e-mail do dono e mesmo proxy do Gemini):

- `estimateNutritionByName` — recebe `{ name, brand, unit }` e devolve a tabela
  nutricional típica por 100 g/ml.
- `estimateServingSize` — recebe `{ name, brand, measures }` (as medidas com que
  o ingrediente é usado, ex.: `["fatia", "colher de sopa"]`) e devolve o peso
  em gramas de 1 medida (`porção padrão`). Ambas são **estimativas**, revisadas
  pela pessoa antes de salvar.

## `extractRecipeFromUrl` — importar receita de um link

Recebe `{ url }` (ou `{ text }`) e devolve a receita estruturada (nome,
ingredientes, passos, categoria…). O cliente chama via
`httpsCallable(functions, 'extractRecipeFromUrl')` (ver `src/lib/recipeImport.ts`).

Como cada fonte é lida:

- **YouTube** — o Gemini lê a URL do vídeo nativamente (`fileData.fileUri`). Não
  precisa de terceiros.
- **Página web** — a função baixa o HTML e tenta extrair `schema.org/Recipe`
  (JSON-LD). Se não houver, manda o texto da página para o Gemini.
- **TikTok / Instagram** — passam por um scraper da **Apify** (essas plataformas
  bloqueiam acesso direto). A função pega legenda + transcrição e manda para o
  Gemini. **Precisa do secret `APIFY_API_TOKEN`** (veja abaixo). Sem ele, o app
  cai no modo "colar texto".
- **Colar texto** — vai direto para o Gemini; não precisa de Apify.

### Secret opcional `APIFY_API_TOKEN` (só para TikTok/Instagram)

1. Crie uma conta grátis em https://apify.com (o plano free dá ~$5/mês de crédito,
   suficiente para uso pessoal) e pegue o token em **Settings → Integrations → API token**.
2. Console → Security → **Secret Manager** → *Create secret*
   - Name: `APIFY_API_TOKEN`
   - Secret value: o seu token
   - (CLI: `firebase functions:secrets:set APIFY_API_TOKEN`)
3. Actors usados (configuráveis por variável de ambiente da função, opcional):
   `APIFY_TIKTOK_ACTOR` (padrão `clockworks~tiktok-scraper`) e
   `APIFY_INSTAGRAM_ACTOR` (padrão `apify~instagram-scraper`).

## Pré-requisitos (uma vez)

Como você não roda nada localmente, faça tudo pelo **Console do Google Cloud /
Firebase** do projeto `app-alimentacao-3a23e`:

1. **Plano Blaze (pay-as-you-go).** Cloud Functions exige o plano Blaze.
   O uso baixo costuma ficar dentro da cota gratuita.
   Firebase Console → ⚙️ → Uso e faturamento → Detalhes do plano → Blaze.

2. **APIs habilitadas** (o deploy tenta habilitar, mas garanta):
   Cloud Functions, Cloud Build, Artifact Registry, Cloud Run e Secret Manager.

3. **Secret com a chave do Gemini** (nome exato `GEMINI_API_KEY`):
   - Pegue uma chave em https://aistudio.google.com/app/apikey
   - Console → Security → **Secret Manager** → *Create secret*
     - Name: `GEMINI_API_KEY`
     - Secret value: a sua chave
   - (Alternativa por CLI, se um dia tiver acesso: `firebase functions:secrets:set GEMINI_API_KEY`)

4. **Permissões da service account** usada no deploy (o secret de GitHub
   `FIREBASE_SERVICE_ACCOUNT`). No IAM, conceda a essa conta os papéis:
   - Cloud Functions Admin
   - Cloud Run Admin
   - Service Account User
   - Artifact Registry Administrator
   - Cloud Build Editor
   - Secret Manager Admin (para vincular o secret à função no deploy)

## Deploy

O deploy é automático: ao dar push em `main` mexendo em `functions/**` ou
`firebase.json`, o workflow `.github/workflows/functions-deploy.yml` roda
`firebase deploy --only functions`. Também dá para disparar manualmente em
**Actions → Deploy Functions → Run workflow**.

## Trocar o modelo

O padrão é `gemini-2.5-flash`. Para mudar, defina a variável de ambiente
`GEMINI_MODEL` da função (Console → Cloud Run → serviço da função → variáveis),
ou ajuste o default em `functions/index.js`.
