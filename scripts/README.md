# Scripts

## Gerar a base da TBCA (`build-tbca.mjs`)

`node scripts/build-tbca.mjs [input.jsonl]` gera `src/data/tbca.json` (consumido
pelo preenchimento automático da tabela nutricional, junto da TACO e do Open
Food Facts). A saída tem a mesma forma de `src/data/taco.json`.

A TBCA ([tbca.net.br](https://www.tbca.net.br), USP/FoRC) não oferece
download/API oficial. O input é um dump em **JSON-lines** (um alimento por
linha, com `codigo`, `classe`, `descricao` e `nutrientes[]`), obtido por
scraping das páginas de composição. Por padrão o script lê
`scripts/data/tbca-raw.jsonl` (não versionado — ver `.gitignore`). O `codigo`
alfanumérico da TBCA vira o `id` do alimento e é o valor gravado em `tbca_code`.

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
