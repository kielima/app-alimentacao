# Cloud Functions — proxy do Gemini

A função `extractNutrition` recebe a foto de uma tabela nutricional (base64),
chama o Google Gemini com a **chave guardada no servidor** e devolve os valores
extraídos. Assim a chave do Gemini **nunca vai para o bundle do cliente**.

- Só usuários logados com o e-mail do dono (`kly@sapo.pt`) podem chamar — isso
  protege a quota do Gemini contra abuso.
- O cliente chama via `httpsCallable(functions, 'extractNutrition')`
  (ver `src/lib/gemini.ts`).

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
