# Scripts

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
