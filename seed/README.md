# Seed Data — App de Alimentação

Dados iniciais usados **apenas** pela importação manual em **Perfil → Catálogo inicial**, que copia o conteúdo destes ficheiros para `users/{uid}/userIngredients`, `users/{uid}/recipes` e `users/{uid}/userMeals` no Firestore (preservando IDs, idempotente).

O app de runtime **não lê** estes ficheiros — toda a UI lê das coleções por-utilizador no Firestore. Depois de o utilizador clicar em "Importar catálogo base" uma vez, estes JSONs podem ser apagados do repositório.

## Arquivos

| Arquivo | Conteúdo | Status |
|---|---|---|
| `ingredients.json` | Base de ingredientes: 7 produtos comerciais (com `brand`) extraídos das fotos em `../TABELAS NUTRICIONAIS/` + 12 ingredientes genéricos iniciais com valores aproximados. | Parcial |
| `recipes.json` | 92 receitas mapeadas de `../livro de receitas.md`: 13 totalmente parseadas, 79 com metadados básicos + flag `needs_review`. | Parcial |

## Como o seed foi gerado

### `ingredients.json`

1. **Produtos comerciais (7 itens com `brand`)** — extraídos pela leitura direta de cada uma das 8 fotos em `TABELAS NUTRICIONAIS/` usando capacidade de visão do Claude. As fotos #1 e #2 (`15.10.56.jpeg` e `15.12.21.jpeg`) são do mesmo produto (Urbano 7 Grãos) — consolidadas em um único registro.

2. **Ingredientes genéricos (12 stubs)** — adicionados manualmente os mais frequentes no livro de receitas, com valores nutricionais aproximados (referência: USDA FoodData Central). Todos marcados com `needs_review: true` até validação contra a Tabela TACO da Unicamp.

### `recipes.json`

1. Cada bloco `## NOME` no markdown original virou um registro. 139 ocorrências de `## `, mas após filtrar subseções (`## Ingredientes`, `## Modo de preparo`, etc.) restaram 92 receitas únicas + 1 não-receita (DIFUSOR AMBIENTES) que foi descartada.

2. Cada receita tem `source_lines: [inicio, fim]` apontando para o trecho no markdown original — facilita revisão e parsing incremental.

3. 13 receitas foram totalmente parseadas (campo `ingredients` e `steps` preenchidos). As outras 79 têm apenas metadados básicos e flag `needs_review: true`.

## Próximos passos

### Curto prazo (antes da Fase 1)

- [ ] **Validação visual**: conferir as 7 entradas com `brand` contra as fotos originais
- [ ] **Amostragem de receitas**: validar 6 receitas aleatórias do conjunto `fully_parsed` contra o markdown
- [ ] **Ingredientes genéricos**: consolidar lista dos ingredientes citados nas 13 receitas parseadas e cadastrar os que faltam

### Médio prazo (durante a Fase 3 — Módulo Receitas)

- [ ] **Completar 79 receitas em lotes**: usar Claude para parsear 10–15 por vez, validando antes de commitar
- [ ] **Consolidar duplicatas**: `tiramissu` ↔ `tiramisu`, `overnight` ↔ `overnight-oat`
- [ ] **Substituir referências genéricas por IDs**: o campo `ingredient_id: null` precisa ser preenchido para cada item — implica também cadastrar o ingrediente em `ingredients.json` se ainda não existir

### Longo prazo

- [ ] **Substituir valores nutricionais aproximados pela Tabela TACO** (Unicamp / FCF, domínio público)
- [ ] **Adicionar fotos das receitas** (campo `photos[]` vazio em todas)

## Schemas

### `ingredient`

```ts
{
  id: string;                    // kebab-case, único
  name: string;
  brand?: string;                // só para produtos comerciais
  default_unit: "g" | "ml" | "unit";
  serving_size_g?: number;
  serving_description?: string;  // "1 fatia", "½ xícara"
  nutrition_per_100: {
    calories: number;
    protein: number;
    carbs: number;
    sugars?: number;
    fat: number;
    saturated_fat?: number;
    fiber?: number;
    sodium?: number;
  } | null;
  extras_per_100?: {             // micronutrientes adicionais
    calcium_mg?: number;
    iron_mg?: number;
    [key: string]: number | undefined;
  };
  ingredients_text?: string;     // lista de ingredientes do produto comercial
  allergens?: string;
  source_image?: string;         // caminho relativo da foto, quando aplicável
  needs_review?: boolean;        // true até validação manual
  notes?: string;
}
```

### `recipe`

```ts
{
  id: string;                    // kebab-case, único
  name: string;
  category: "pratos-principais" | "bebidas" | "sobremesas-e-lanches" | "molhos-temperos-acompanhamentos";
  prep_time_min?: number | null;
  difficulty?: "facil" | "medio" | "dificil" | null;
  rating?: 1 | 2 | 3 | 4 | 5 | null;
  photos: string[];
  ingredients: Array<{
    raw_text: string;            // texto original do markdown — preserva info perdida no parse
    ingredient_id: string | null;
    quantity: number | null;
    unit: string | null;         // "g", "ml", "unit", "xc" (xícara), "cs" (col. sopa), "dt" (dente), "a_gosto"
  }>;
  steps: string[];
  source_lines: [number, number];
  notes?: string;
  season?: "verao" | "outono" | "inverno" | "primavera";
  needs_review?: boolean;
}
```

## Convenções de unidade

| Sigla | Significado |
|---|---|
| `g` | gramas |
| `ml` | mililitros |
| `unit` | unidade (1 cebola, 1 ovo) |
| `xc` | xícara |
| `cs` | colher de sopa |
| `cc` | colher de chá |
| `dt` | dente (de alho) |
| `mç` | maço |
| `pct` | pacote |
| `a_gosto` | quantidade não especificada |

A conversão para gramas/ml será feita no app (tabela de conversões em `src/utils/units.ts`, futura).
