# Scripts

## Tabelas nutricionais

Dois pipelines populam `seed/ingredients.json` automaticamente.

### `npm run import:tbca` — ingredientes genéricos via TBCA

Usa a **Tabela Brasileira de Composição de Alimentos** (USP/FoRC) — http://www.tbca.net.br.

**Setup:**

1. Baixe o CSV em https://www.kaggle.com/datasets/proflucassoares/alimentos-brasileiros-com-dados-da-tbca (precisa login Kaggle).
2. Salve em `scripts/data/tbca.csv` (já está no `.gitignore`).
3. `npm run import:tbca -- --dry` pra ver o que seria mudado.
4. `npm run import:tbca` pra escrever no seed.

**Como o matching funciona:**

- Nome normalizado (sem acento, sem palavras genéricas tipo "cru/cozido").
- Jaro-Winkler ≥ 0.92 + margem de 0.02 sobre o segundo melhor → auto-match.
- Entre 0.75 e 0.92 → gravado em `scripts/data/tbca-candidates.json` pra revisão manual (formato `[{ingredient_id, ingredient_name, score, tbca_code, tbca_name}]`).
- Tudo que é auto-preenchido recebe `needs_review: true` — filtre no app antes de tirar o flag.

Idempotente: rodar de novo só toca em ingredientes sem `tbca_code`.

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
