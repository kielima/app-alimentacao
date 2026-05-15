# Plano de Projeto — App de Alimentação (PWA)

> **Versão:** 1.0  
> **Data:** 2026-05-10  
> **Status:** Planejamento concluído — pronto para iniciar desenvolvimento

---

## 1. Visão Geral

App pessoal de gestão alimentar, instalável como PWA (Progressive Web App) no celular e acessível pelo computador. Hospedado gratuitamente no GitHub Pages, com dados sincronizados em tempo real via Firebase. Uso exclusivo de Kiê e seu marido.

### Resumo em uma linha
> Gerenciar receitas, dispensa, lista de compras e plano alimentar diário — tudo conectado por uma base única de ingredientes com tabelas nutricionais.

---

## 2. Usuários

| Quem | Acesso |
|---|---|
| Kiê | PIN de entrada — acesso total |
| Marido | PIN de entrada — acesso total |

- O PIN é compartilhado (único para os dois)
- Proteção apenas contra acesso acidental de curiosos — não é segurança robusta
- Dados sincronizados em tempo real entre os dois dispositivos

---

## 3. Módulos e Funcionalidades

### 3.1 🍳 Receitas

**Propósito:** Livro de receitas digital com dados nutricionais calculados automaticamente.

**Funcionalidades:**
- Listar receitas com foto de capa, nome, categoria e avaliação
- Cadastrar e editar receitas com:
  - Fotos (múltiplas, adicionáveis ao longo do tempo)
  - Categoria (ex: Pratos Principais, Lanches, Sobremesas, Bebidas, Molhos)
  - Tempo de preparo
  - Nível de dificuldade (Fácil / Médio / Difícil)
  - Avaliação em estrelas (1–5)
  - Custo estimado (calculado a partir dos preços da lista de compras)
  - Modo de preparo (passo a passo)
  - Ingredientes com quantidade e unidade → vinculados à base única
- Ao visualizar uma receita:
  - Ver tabela de nutrientes totais (calculada a partir das quantidades dos ingredientes)
  - Ver quais ingredientes estão na dispensa e se estão dentro da validade *(integração Dispensa)*
  - Gerar lista de ingredientes faltantes com um toque *(integração Lista de Compras)*
  - Clicar em qualquer ingrediente para abrir sua página nutricional

**Dados iniciais:** importados de `livro de receitas.md`

---

### 3.2 🥫 Dispensa

**Propósito:** Controle do que tem em casa, com alerta de validade.

**Funcionalidades:**
- Listar itens em estoque com quantidade, unidade e data de validade
- Cadastrar e editar itens — ingrediente vinculado à base única
- Indicadores visuais de status:
  - ✅ Dentro do prazo
  - ⚠️ Vencendo em breve (≤ 3 dias)
  - ❌ Vencido
- Filtros: todos / disponíveis / vencendo / vencidos
- Ao clicar em um item: abrir página do ingrediente (tabela nutricional)
- Itens vencidos ou esgotados podem ser enviados à Lista de Compras com um toque *(integração)*

---

### 3.3 🛒 Lista de Compras

**Propósito:** Lista inteligente integrada com receitas e dispensa.

**Funcionalidades:**
- Listar itens a comprar com quantidade, unidade, mercado e preço estimado
- Marcar itens como comprados (check) → opção de enviar automaticamente para a Dispensa com data de validade
- Adicionar itens manualmente (ingrediente da base única)
- Gerar lista automaticamente a partir de:
  - Ingredientes faltantes de uma receita selecionada
  - Itens vencidos/esgotados da dispensa
- Metadados por item:
  - Mercado onde comprar
  - Preço unitário
- Ao clicar em um item: abrir página do ingrediente

---

### 3.4 📅 Plano Alimentar

**Propósito:** Visualizar o plano alimentar do dia com totais de nutrientes calculados automaticamente.

**Funcionalidades:**
- Exibir as refeições de **um dia por vez** (padrão: dia atual)
- Navegação entre os dias da semana (Segunda → Domingo)
- Para cada refeição (ex: Café da Manhã, Lanche da Manhã, Almoço, Pré-Treino, Pós-Treino, Jantar, Ceia):
  - Lista de alimentos com quantidade e unidade
  - Tabela de nutrientes da refeição (soma automática dos ingredientes)
- Resumo diário no topo: calorias, proteína, carboidrato, gordura totais do dia
- Opção de **substituir um alimento** por uma alternativa equivalente *(funcionalidade completa em versão futura — estrutura preparada desde o início)*
- Ao clicar em qualquer alimento: abrir página do ingrediente

**Plano inicial:** importado do plano alimentar existente (dias de treino e dias sem treino)  
**Atualização:** editável diretamente no app quando o plano for revisado

---

### 3.5 🥕 Página do Ingrediente (transversal)

Acessível de qualquer módulo ao clicar em um ingrediente.

**Contém:**
- Nome e foto (opcional)
- Unidade padrão (g, ml, unidade)
- Tabela nutricional por 100g/ml:
  - Calorias (kcal)
  - Proteína (g)
  - Carboidratos (g) — dos quais açúcares
  - Gorduras totais (g) — das quais saturadas
  - Fibras (g)
  - Sódio (mg)
- Calculadora rápida: inserir quantidade → ver nutrientes proporcionais
- Onde aparece: receitas que usam este ingrediente, itens na dispensa
- Substitutos *(campo reservado — a ser preenchido em versão futura)*

**Base de dados:** construída a partir das tabelas nutricionais dos arquivos do projeto

---

## 4. Modelo de Dados

A **base de ingredientes** é a entidade central. Todas as outras entidades referenciam ingredientes por ID — nunca duplicam informações nutricionais.

```
ingredients (base única)
├── id
├── name
├── default_unit (g | ml | unit)
├── nutrition_per_100:
│   ├── calories
│   ├── protein
│── ├── carbs
│   ├── sugars
│   ├── fat
│   ├── saturated_fat
│   ├── fiber
│   └── sodium
├── photo_url (opcional)
└── substitutes[] → [ingredient_id] (futuro)

recipes
├── id, name, category
├── prep_time (min), difficulty, rating, estimated_cost
├── photos[]
├── steps[] (passo a passo)
└── ingredients[]:
    ├── ingredient_id → ref base
    ├── quantity
    └── unit

pantry (dispensa)
├── id
├── ingredient_id → ref base
├── quantity, unit
├── expiry_date
└── store (mercado onde foi comprado)

shopping_list
├── id
├── ingredient_id → ref base
├── quantity, unit
├── store (mercado)
├── estimated_price
├── checked (bool)
└── source (manual | from_recipe | from_pantry)

meal_plan
├── day_of_week (0=seg … 6=dom)
├── plan_type (training_day | rest_day)
└── meals[]:
    ├── meal_type (breakfast | morning_snack | lunch | pre_workout | post_workout | dinner | supper)
    ├── items[]:
    │   ├── ingredient_id → ref base
    │   ├── quantity
    │   └── unit
    └── computed_nutrition (calculado no cliente, não armazenado)
```

---

## 5. Arquitetura Técnica

### Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | React + Vite | Popular, boa performance, bom suporte a PWA |
| Estilização | Tailwind CSS | Dark/light mode nativo, responsivo fácil |
| PWA | Vite PWA Plugin (Workbox) | Service worker, installable, offline parcial |
| Banco de dados | Firebase Firestore | Sync em tempo real, gratuito para uso pessoal, sem pausa |
| Autenticação | Firebase Auth (anônimo + PIN) | Simples, sem cadastro de e-mail |
| Hospedagem | GitHub Pages | Gratuito, integrado ao repositório |
| Deploy automático | GitHub Actions | A cada push na branch main, publica automaticamente |

### Fluxo de dados

```
Celular (Kiê)          Computador (marido)
      │                        │
      └──────── Firebase ───────┘
                    │
             GitHub Pages
           (app — estático)
```

### Autenticação com PIN

- Na primeira abertura: criar PIN (4–6 dígitos)
- A cada abertura: inserir PIN
- PIN armazenado com hash no Firebase (não fica em texto puro)
- Sessão persiste no dispositivo por 30 dias (não precisa reinserir toda hora)

### Offline

- Leitura: funciona offline (Firestore tem cache local automático)
- Escrita: fica na fila e sincroniza ao reconectar
- App é instalável na tela inicial (ícone, splash screen)

---

## 6. Design

### Requisitos visuais
- Dark mode e Light mode (segue preferência do sistema operacional, com toggle manual)
- Interface otimizada para celular (mobile-first)
- Navegação por abas na parte inferior da tela (padrão mobile)
- Paleta a definir na fase de design

### Navegação

```
┌─────────────────────────────┐
│         Conteúdo da aba     │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│  🍳    🥫    🛒    📅       │
│ Receitas Disp. Compras Plano│
└─────────────────────────────┘
```

### Telas a prototipar (antes de codificar)
- [ ] Tela de PIN
- [ ] Home / lista de cada módulo
- [ ] Página de ingrediente
- [ ] Formulário de receita
- [ ] Visualização de receita
- [ ] Dispensa
- [ ] Lista de compras
- [ ] Plano alimentar — dia atual
- [ ] Plano alimentar — navegação entre dias

---

## 7. Dados Iniciais (Seed)

Os seguintes arquivos serão processados para popular o banco de dados na primeira configuração:

| Arquivo | O que gera |
|---|---|
| `livro de receitas.md` | Coleção inicial de receitas + lista de ingredientes |
| `TABELAS NUTRICIONAIS/` (imagens) | Tabela nutricional de cada ingrediente (extração manual ou OCR) |
| `Lista_Compras_Semanal.md` | Lista de ingredientes frequentes com quantidades de referência |
| Plano alimentar (CLAUDE.md §6) | Plano semanal inicial com refeições dos dias de treino e descanso |

> **Nota:** As imagens de tabelas nutricionais precisarão ser processadas (leitura manual ou OCR) para extrair os valores e inserir na base de ingredientes. Isso será feito na Fase 2.

---

## 8. Fases de Desenvolvimento

### Fase 1 — Fundação (Setup)
- [ ] Criar repositório no GitHub
- [ ] Configurar projeto React + Vite + Tailwind
- [ ] Configurar Vite PWA Plugin
- [ ] Criar projeto no Firebase (Firestore + Auth)
- [ ] Configurar GitHub Actions para deploy automático no GitHub Pages
- [ ] Tela de PIN funcional
- [ ] Estrutura de navegação por abas (layout base)
- [ ] Dark/light mode funcionando

### Fase 2 — Base de Ingredientes
- [ ] Processar tabelas nutricionais das imagens → planilha de dados
- [ ] Criar tela de ingredientes (listagem + busca)
- [ ] Criar página individual do ingrediente com tabela nutricional
- [ ] Calculadora rápida de nutrientes por quantidade
- [ ] Popular banco com ingredientes do livro de receitas + tabelas

### Fase 3 — Módulo Receitas
- [ ] Importar `livro de receitas.md` como seed de dados
- [ ] Tela de listagem com filtros (categoria, dificuldade, avaliação)
- [ ] Página de receita com ingredientes, modo de preparo, nutrientes totais
- [ ] Cadastro e edição de receitas
- [ ] Upload de fotos
- [ ] Indicador de disponibilidade de ingredientes (integração Dispensa — leitura simples)

### Fase 4 — Módulo Dispensa
- [ ] Tela de listagem com status de validade
- [ ] Cadastro e edição de itens
- [ ] Alertas visuais de vencimento
- [ ] Enviar item vencido/esgotado para Lista de Compras

### Fase 5 — Módulo Lista de Compras
- [ ] Tela de lista com check de itens comprados
- [ ] Geração automática a partir de receita (ingredientes faltantes)
- [ ] Geração automática a partir da dispensa (vencidos/esgotados)
- [ ] Ao marcar como comprado: enviar para Dispensa com validade

### Fase 6 — Módulo Plano Alimentar
- [ ] Importar plano alimentar existente como seed
- [ ] Tela com refeições do dia atual
- [ ] Cálculo automático de nutrientes por refeição e total do dia
- [ ] Navegação entre dias da semana
- [ ] Edição do plano alimentar
- [ ] Estrutura de substituições (campo reservado, interface básica)

### Fase 7 — Integrações e Polish
- [ ] Revisão completa das integrações entre módulos
- [ ] Testes em dispositivos reais (celular Kiê + dispositivo marido)
- [ ] Ajustes de UX / responsividade
- [ ] Otimização de performance (lazy loading de imagens, etc.)
- [ ] Ícone do app e splash screen

### Fase Futura — Substituições
- [ ] Tabela de substituições alimentares
- [ ] Funcionalidade de substituição no Plano Alimentar

---

## 9. Decisões Técnicas Registradas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Firebase Firestore | Supabase | Firestore nunca pausa o projeto no plano gratuito; setup mais simples |
| GitHub Pages | Vercel, Netlify | Mantém tudo no mesmo ecossistema (código + hospedagem) |
| React + Vite | Vue, SvelteKit | Maior ecossistema, mais exemplos com Firebase |
| PWA (web) | APK Android (Android Studio) | Sem necessidade de Android Studio; funciona em qualquer dispositivo; deploy simplificado |
| PIN local + Firebase Auth | Auth completo (e-mail/senha) | Uso pessoal — complexidade desnecessária |

---

## 10. Fora do Escopo (por ora)

- Compartilhamento de receitas com outras pessoas
- Integração com apps externos (MyFitnessPal, etc.)
- Notificações de validade (push notifications)
- Histórico de refeições por dia (tracking de o que foi comido de fato)
- Versão iOS / Android nativa
- Multi-usuário com perfis separados

---

*Última atualização: 2026-05-10*
