# Wireframes — App de Alimentação (PWA)

> Wireframes ASCII das 8 telas listadas no plano-projeto §6.
> Foco: layout, fluxo de navegação e hierarquia de informação.
> Não representam cor, tipografia ou pixel-perfect — isso fica para o código com Tailwind + shadcn/ui.

Layout base: mobile-first, largura ~360–400px, navegação por abas no rodapé.

---

## 1. Tela de PIN

Mostrada na abertura do app quando a sessão de 30 dias expira.

```
┌──────────────────────────────┐
│                              │
│                              │
│         🍳 (logo)            │
│                              │
│      App de Alimentação      │
│                              │
│       Insira seu PIN         │
│                              │
│      ┌──┐┌──┐┌──┐┌──┐        │
│      │  ││  ││  ││  │        │
│      └──┘└──┘└──┘└──┘        │
│                              │
│   ┌───┐  ┌───┐  ┌───┐        │
│   │ 1 │  │ 2 │  │ 3 │        │
│   ├───┤  ├───┤  ├───┤        │
│   │ 4 │  │ 5 │  │ 6 │        │
│   ├───┤  ├───┤  ├───┤        │
│   │ 7 │  │ 8 │  │ 9 │        │
│   ├───┤  ├───┤  ├───┤        │
│   │   │  │ 0 │  │ ⌫ │        │
│   └───┘  └───┘  └───┘        │
│                              │
│    Esqueceu? (apagar dados)  │
│                              │
└──────────────────────────────┘
```

**Estados:**
- Vazio → preenchendo (dots/números) → erro (shake + reset) → sucesso (transição para Receitas)
- Primeiro acesso: substitui "Insira seu PIN" por "Crie um PIN (4–6 dígitos)" + confirmação

---

## 2. Receitas — listagem

Aba `🍳 Receitas` (default ao abrir).

```
┌──────────────────────────────┐
│ 🍳 Receitas        ➕  🌙    │  ← header: título, novo, dark/light
├──────────────────────────────┤
│  🔍 Buscar receita…          │
│                              │
│  [Tudo] [Pratos] [Sobre…] +  │  ← chips de filtro de categoria
│  ⭐ Avaliação  ⏱ Tempo  ▼    │  ← filtros adicionais
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ [📷]  Espaguete ao Pesto │ │
│ │       Pratos · ⭐⭐⭐⭐    │ │
│ │       ⏱ 30 min · 🟢 5/5  │ │  ← ingredientes na dispensa
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ [📷]  Lasanha 4 Queijos  │ │
│ │       Pratos · ⭐⭐⭐⭐⭐  │ │
│ │       ⏱ 60 min · 🟡 3/8  │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ [📷]  Caldo de Kabocha   │ │
│ │       Pratos · ⭐⭐⭐⭐    │ │
│ │       ⏱ 45 min · 🟢 2/2  │ │
│ └──────────────────────────┘ │
│              …               │
├──────────────────────────────┤
│  🍳    🥫    🛒    📅        │  ← tab bar
│  Rec   Disp  Comp  Plano     │
└──────────────────────────────┘
```

**Indicador de dispensa:** `🟢 X/Y` = X de Y ingredientes da receita estão disponíveis.

---

## 3. Receita — visualização

Toque numa receita da listagem.

```
┌──────────────────────────────┐
│ ←  ESPAGUETE AO PESTO    ⋮   │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │       [foto capa]        │ │
│ │      (swipe extra fotos) │ │
│ └──────────────────────────┘ │
│                              │
│ Pratos · ⭐⭐⭐⭐ · ⏱ 30 min   │
│ Fácil  · Custo estimado R$15 │
│                              │
│ ┌── INGREDIENTES ── 5/7 ──┐  │
│ │ ✅ Espaguete         500g│  │  ← clique abre página ingrediente
│ │ ✅ Manjericão fresco 1mç │  │
│ │ ✅ Pinhões          50g │  │
│ │ ❌ Parmesão        100g │  │  ← faltando
│ │ ❌ Azeite           ½xc │  │
│ │ ✅ Alho           2 dt  │  │
│ │ ✅ Sal       a gosto    │  │
│ │                         │  │
│ │ [➕ Adicionar à lista]   │  │  ← gera lista com 2 faltantes
│ └─────────────────────────┘  │
│                              │
│ ┌── MODO DE PREPARO ──────┐  │
│ │ 1. Processe manjericão… │  │
│ │ 2. Adicione alho…       │  │
│ │ ...                     │  │
│ └─────────────────────────┘  │
│                              │
│ ┌── INFO NUTRICIONAL ─────┐  │
│ │  Por porção (200g):     │  │
│ │  • 420 kcal             │  │
│ │  • 14 g proteína        │  │
│ │  • 52 g carboidratos    │  │
│ │  • 18 g gordura         │  │
│ │  [Ver detalhado]        │  │
│ └─────────────────────────┘  │
├──────────────────────────────┤
│  🍳    🥫    🛒    📅        │
└──────────────────────────────┘
```

---

## 4. Receita — formulário (cadastro/edição)

Botão `➕` na listagem ou `⋮ → Editar` na visualização.

```
┌──────────────────────────────┐
│ ✕  Nova receita      Salvar  │
├──────────────────────────────┤
│ Nome                         │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ └──────────────────────────┘ │
│                              │
│ Categoria       Avaliação    │
│ ┌─────────┐    ⭐⭐⭐⭐⭐      │
│ │ Pratos ▾│                  │
│ └─────────┘                  │
│                              │
│ Tempo (min)    Dificuldade   │
│ ┌─────┐       ◯ Fácil        │
│ │     │       ◯ Médio        │
│ └─────┘       ◯ Difícil      │
│                              │
│ Fotos                        │
│ ┌──┐ ┌──┐ ┌──┐ [+]           │
│ └──┘ └──┘ └──┘               │
│                              │
│ ── INGREDIENTES ──           │
│ ┌──────────────────────────┐ │
│ │ 🔍 Buscar ingrediente…   │ │
│ │ 500g   espaguete      🗑  │ │
│ │ 1 mç   manjericão     🗑  │ │
│ │ + Adicionar             │ │
│ └──────────────────────────┘ │
│                              │
│ ── MODO DE PREPARO ──        │
│ ┌──────────────────────────┐ │
│ │ 1. │ Lave o manjericão… │ │
│ │ 2. │ Bata no proc…      │ │
│ │ + Passo                  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 5. Dispensa

Aba `🥫`.

```
┌──────────────────────────────┐
│ 🥫 Dispensa         ➕  🌙   │
├──────────────────────────────┤
│  🔍 Buscar item…             │
│                              │
│ [Todos] [✅] [⚠️] [❌]        │  ← filtros por status
├──────────────────────────────┤
│ ⚠️ VENCENDO (3)              │
│ ┌──────────────────────────┐ │
│ │ Iogurte Natural    200g  │ │
│ │ ⚠️ vence em 2 dias       │ │
│ │ Comprado em: Pão de Açúcar│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Queijo Minas       400g  │ │
│ │ ⚠️ vence em 3 dias       │ │
│ └──────────────────────────┘ │
│                              │
│ ✅ DISPONÍVEIS (14)          │
│ ┌──────────────────────────┐ │
│ │ Arroz 7 Grãos      1kg   │ │
│ │ ✅ vence em 4 meses      │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Atum em Lata    2 unid.  │ │
│ │ ✅ vence em 8 meses      │ │
│ └──────────────────────────┘ │
│              …               │
│                              │
│ ❌ VENCIDOS (1)              │
│ ┌──────────────────────────┐ │
│ │ Leite              500ml │ │
│ │ ❌ venceu há 3 dias       │ │
│ │ [Mover para Lista]       │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  🍳    🥫    🛒    📅        │
└──────────────────────────────┘
```

**Cores de status:** verde (`bg-green-500`), âmbar (`bg-amber-500`), vermelho (`bg-red-500`). Critério: ≤3 dias = âmbar; <0 dias = vermelho.

---

## 6. Lista de Compras

Aba `🛒`.

```
┌──────────────────────────────┐
│ 🛒 Compras          ➕  🌙   │
├──────────────────────────────┤
│                              │
│ Total estimado: R$ 87,40     │
│ 3 mercados                   │
│                              │
│ ┌── PÃO DE AÇÚCAR ──────────┐│
│ │ ☐ Iogurte natural 1L     ││
│ │   R$ 8,90                ││
│ │ ☐ Maçã Fuji 6 un.        ││
│ │   R$ 12,00               ││
│ │ ☑ Pão integral 1 un.     ││
│ │   R$ 9,50  (na dispensa) ││
│ └──────────────────────────┘│
│                              │
│ ┌── HORTIFRUTI ─────────────┐│
│ │ ☐ Couve-flor 1 un.       ││
│ │ ☐ Brócolis 400g          ││
│ └──────────────────────────┘│
│                              │
│ ┌── OUTROS ─────────────────┐│
│ │ ☐ Atum em Lata 2 un.     ││
│ │   ← Sopa de Legumes      ││  ← origem (receita ou dispensa)
│ │ ☐ Linhaça 200g           ││
│ │   ← Vencido na dispensa  ││
│ └──────────────────────────┘│
│                              │
│ [Marcar comprados → Dispensa]│  ← envia itens ☑ p/ dispensa
├──────────────────────────────┤
│  🍳    🥫    🛒    📅        │
└──────────────────────────────┘
```

---

## 7. Plano Alimentar — dia atual

Aba `📅`.

```
┌──────────────────────────────┐
│ 📅 Plano Alimentar  📝  🌙   │
├──────────────────────────────┤
│ ◀  Quinta, 15 mai     ▶      │  ← navegação ◀▶ entre dias
│ Dia de Treino                │
│                              │
│ ┌── HOJE ──────────────────┐ │
│ │ 2.180 kcal               │ │
│ │ ▰▰▰▰▰▰▰▰▰▰ proteína 140g │ │
│ │ ▰▰▰▰▰▰▰▰▰▰ carbs 220g    │ │
│ │ ▰▰▰▰▰▰▰ gordura 70g      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── ☕ CAFÉ DA MANHÃ ───────┐ │
│ │ 2 fatias pão integral    │ │
│ │ 2 ovos mexidos           │ │
│ │ 1 banana                 │ │
│ │ 450 kcal · 22 P · 60 C   │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── 🥪 LANCHE DA MANHÃ ────┐ │
│ │ 170g iogurte natural     │ │
│ │ 1 maçã                   │ │
│ │ 220 kcal · 8 P · 35 C    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── 🥗 ALMOÇO ─────────────┐ │
│ │ 180g peito de frango     │ │
│ │ 100g arroz integral      │ │
│ │ Salada (100g)            │ │
│ │ 480 kcal · 45 P · 55 C   │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── 🏋️ PRÉ-TREINO ─────────┐ │
│ │ 150g batata-doce         │ │
│ │ 1 maçã                   │ │
│ └──────────────────────────┘ │
│ ┌── 💪 PÓS-TREINO ─────────┐ │
│ ┌── 🍽️ JANTAR ─────────────┐ │
│ ┌── 🌙 CEIA ───────────────┐ │
├──────────────────────────────┤
│  🍳    🥫    🛒    📅        │
└──────────────────────────────┘
```

**Edição:** botão `📝` no header alterna para modo edição (campos editáveis inline). Cada refeição clicável expande para detalhes.

---

## 8. Página do Ingrediente (transversal)

Acessível ao tocar em qualquer ingrediente de qualquer tela.

```
┌──────────────────────────────┐
│ ←  Arroz 7 Grãos        ⋮    │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │     [foto embalagem]     │ │
│ └──────────────────────────┘ │
│                              │
│ Urbano · Cereal              │  ← brand quando aplicável
│ Porção padrão: 50g (½ xíc)   │
│                              │
│ ┌── CALCULADORA ───────────┐ │
│ │ ┌─────┐  por             │ │
│ │ │ 100 │  g                │ │
│ │ └─────┘                   │ │
│ │                           │ │
│ │ • 223 kcal                │ │
│ │ • 5,9 g proteína          │ │
│ │ • 44 g carboidratos       │ │
│ │ • 2,8 g gordura           │ │
│ │ • 0,6 g g. saturada       │ │
│ │ • 2,8 g fibras            │ │
│ │                           │ │
│ │ Ver micronutrientes ▾     │ │  ← cálcio, ferro etc
│ └───────────────────────────┘ │
│                              │
│ ┌── NA DISPENSA ───────────┐ │
│ │ ✅ 800g — vence em 4 m   │ │
│ │ [➕ Cadastrar item]      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── USADO EM ──────────────┐ │
│ │ Salada de Grãos          │ │
│ │ Bowl Vegetal             │ │
│ │ Risoto Integral          │ │
│ └──────────────────────────┘ │
│                              │
│ ┌── SUBSTITUTOS ───────────┐ │
│ │ (em breve)               │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## Componentes compartilhados

### Header (todas as telas)
```
┌──────────────────────────────┐
│ ←/icone  TÍTULO    ações…    │
└──────────────────────────────┘
```

### Tab bar (telas raiz dos 4 módulos)
```
┌──────────────────────────────┐
│  🍳    🥫    🛒    📅        │
│  Rec   Disp  Comp  Plano     │
└──────────────────────────────┘
```
- Ícone ativo: verde-oliva (`#6b8e23`); inativos: neutral-500
- Sempre fixa na base, sobrepondo conteúdo (z-index alto)

### Bottom sheet (cadastro/edição rápida)
- Sobe pela base, ocupa ~70% da altura
- Usado para: cadastro rápido de item na dispensa, item na lista de compras
- Componente shadcn/ui `Sheet`

### Cards (listagem)
- Padding 12px, border-radius 12px, sombra suave
- Touch target mínimo 56px (acessibilidade mobile)
