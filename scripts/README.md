# Scripts

## Tabelas nutricionais

Dois pipelines populam `seed/ingredients.json` automaticamente.

### `npm run scrape:tbca` — ingredientes genéricos via TBCA (sem CSV)

Faz scraping direto do site http://www.tbca.net.br. **Não precisa baixar nada.**

```
npm run scrape:tbca -- --dry        # preview
npm run scrape:tbca                 # escreve no seed
npm run scrape:tbca -- --code-only  # só preenche tbca_code (preserva nutri existente)
```

**Como o matching funciona:**

- Baixa todas as ~59 páginas de listagem (~5800 alimentos).
- Nome normalizado (sem acento, sem palavras genéricas tipo "cru/cozido").
- Jaro-Winkler ≥ 0.92 + margem de 0.02 sobre o segundo melhor.
- **Token check:** todos os tokens significativos do nome do ingrediente
  precisam aparecer no nome TBCA — evita falsos positivos do tipo
  "farinha-de-trigo → Farinha de rosca".
- Pros matches restantes, baixa a página de composição e extrai os valores.
- Tudo que é auto-preenchido recebe `needs_review: true`.

Idempotente: rodar de novo só toca em ingredientes sem `tbca_code`.

### `npm run import:tbca` — via CSV do Kaggle (alternativa)

Funciona igual ao `scrape:tbca` mas a partir do CSV em
https://www.kaggle.com/datasets/proflucassoares/alimentos-brasileiros-com-dados-da-tbca
(precisa login Kaggle). Salve em `scripts/data/tbca.csv` e rode
`npm run import:tbca`. Útil se o site da TBCA estiver fora do ar.

### `npm run import:off` — produtos com marca via Open Food Facts

Usa a API pública do **Open Food Facts** — https://br.openfoodfacts.org.

**Setup:**

1. Em `seed/ingredients.json`, preencha `off_barcode` no produto (EAN-13 da embalagem).
2. `npm run import:off -- --dry` pra preview.
3. `npm run import:off` pra escrever.

Flags:
- `--force` sobrescreve `nutrition_per_100` mesmo se já tiver valor (use só se quiser sincronizar com mudanças no OFF).

Idempotente: por padrão só preenche quem está com `nutrition_per_100: null`.

## Footer no app

`src/pages/IngredienteDetalhe.tsx` mostra automaticamente:
- 🥬 link pra Hortipédia da CEAGESP (se `ceagesp_slug`)
- 🍽️ citação da TBCA + código (se `tbca_code`)
- 🏷️ link pro produto no Open Food Facts (se `off_barcode`)

## Scanner de código de barras (in-app)

O scanner roda na hora — não precisa de script. Em **Compras**, **Dispensa** e
**Ingredientes** há um botão 📷 no cabeçalho que abre o modal de câmera. A
detecção usa o `BarcodeDetector` nativo (Chrome Android, Safari iOS 16.4+) ou
faz fallback pra `@zxing/browser` por dynamic import.

Quando o EAN é encontrado no [Open Food Facts](https://br.openfoodfacts.org),
o produto é adicionado direto na lista escolhida e (se for inédito) cadastrado
como ingrediente do usuário com `off_barcode` preenchido. Quando o EAN não está
no OFF, o app abre o formulário de cadastro manual com o código já preenchido
e, opcionalmente, salva um rascunho em **Contribuições OFF** (menu lateral) pra
você enviar depois pelo formulário oficial do Open Food Facts.

Requisitos: HTTPS (já garantido pelo Firebase Hosting) e permissão de câmera.
