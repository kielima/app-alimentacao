# App de Receitas, Dispensa e Compras — Plano de Projeto

## Objetivo
Criar um app Android pessoal instalado via APK (sem publicar na Play Store), para uso exclusivo no Galaxy Z Flip6, com três módulos integrados.

---

## Módulos

### 📖 Módulo 1 — Livro de Receitas
- Cadastro de receitas com fotos do prato
- Possibilidade de adicionar mais fotos ao longo do tempo
- Metadados:
  - Categoria
  - Tempo de preparo
  - Avaliação em estrelas
  - Nível de dificuldade
  - Preço total dos ingredientes

### 🥫 Módulo 2 — Dispensa
- Cadastro manual de produtos
- Controle de validade
- Integrado com o livro de receitas e a lista de compras

### 🛒 Módulo 3 — Lista de Compras
- Integrada com as receitas e a dispensa
- Ao visualizar uma receita, mostra quais ingredientes já estão na dispensa e se estão dentro da validade
- Metadados por ingrediente:
  - Qual mercado tem o produto
  - Valor do produto

---

## Integrações entre módulos

| De | Para | O que integra |
|---|---|---|
| Livro de Receitas | Dispensa | Verifica disponibilidade e validade dos ingredientes |
| Livro de Receitas | Lista de Compras | Gera lista de ingredientes faltantes automaticamente |
| Dispensa | Lista de Compras | Produtos vencidos ou em falta geram itens na lista |

---

## Visual
- Interface simples e agradável
- Pensado para uso no celular dobrável (Z Flip6)
- Uso exclusivo pessoal

---

## Ambiente de Desenvolvimento

| Item | Detalhe |
|---|---|
| Computador | Windows 11 |
| Android Studio | Instalado — SDK Android 16 |
| Claude Code | Aba "Código" no Claude Desktop |
| Celular | Samsung Galaxy Z Flip6 (Android 16, One UI 8.0) |

---

## Estratégia de Desenvolvimento
Construção em etapas, testando cada módulo antes de avançar:

1. **Etapa 1** — Livro de Receitas (metadados + fotos)
2. **Etapa 2** — Dispensa (cadastro + validades)
3. **Etapa 3** — Lista de Compras
4. **Etapa 4** — Integrações entre os três módulos
5. **Etapa 5** — Geração do APK e instalação no celular

---

## Status Atual

- [x] Android Studio instalado e configurado
- [x] SDK Android 16 instalado
- [x] Claude Code disponível no Claude Desktop
- [x] Pasta do projeto criada
- [ ] Início do desenvolvimento — Etapa 1
