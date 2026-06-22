# Integração com o app de Ritual

Os dois apps (este **app-alimentacao** e o **ritual-app**) compartilham o **mesmo
projeto Firebase** e o mesmo login Google → o mesmo `uid`. Assim cada app lê/escreve
os próprios dados em `users/{uid}/...` e enxerga os do outro, sem backend novo.

## O que a integração faz

1. **Refeição no hábito do ritual** — O ritual lê o plano semanal deste app
   (`users/{uid}/mealPlan/{dia}-{tipo}`) e mostra, no hábito de refeição
   correspondente, a refeição planejada para o dia + um botão que abre este app em
   `/#/plano?day=…&plan=…`. A página **Plano** lê esses parâmetros e pré-seleciona o
   dia/tipo (ver `src/pages/Plano.tsx`).
2. **Água bidirecional** — Este app ganhou um **card de hidratação** na página Plano
   (`src/components/HydrationCard.tsx`) que registra água no **mesmo** dado que o
   ritual usa: `users/{uid}/dados/aguaIngerida` e `users/{uid}/dados/metaAgua`
   (formato envelope `{ json }`), via `src/data/hydration.ts`. Um copo registrado
   aqui aparece na barra de água do ritual ao vivo, e vice-versa.

## Passos para ativar (uma vez)

1. **Mesmo projeto Firebase nos dois apps.** Aponte os `VITE_FIREBASE_*` deste
   `.env.local` e do `.env` do ritual-app para o **mesmo** projeto.
2. **Publique as regras unificadas.** `firestore.rules` deste repo é **idêntico** ao
   do ritual-app (gate de aprovação + bloco público `app/{doc}` do ritual). Publique
   uma vez no projeto compartilhado: `firebase deploy --only firestore:rules`.
3. A chave de data da água é a data **local** `YYYY-MM-DD`, igual à do ritual
   (`dataISO`), para o mesmo dia somar no mesmo lugar nos dois apps.
