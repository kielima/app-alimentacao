import { getAllRecipes } from '../data/recipes';
import { getRecipeCategories, DEFAULT_RECIPE_CATEGORIES } from '../data/recipeCategories';
import type { NutritionPer100 } from '../types/ingredient';
import { primaryCategoryId, recipeCategoryIds, type Recipe, type RecipeIngredient } from '../types/recipe';
import { activeIngredient, computeNutrition, recipeNutritionPer100g } from './nutrition';

/** As opções de um ingrediente (principal + alternativas), com a ativa primeiro. */
function ingredientOptions(item: RecipeIngredient): RecipeIngredient[] {
  if (!item.substitutes || item.substitutes.length === 0) return [item];
  const principal: RecipeIngredient = {
    ...item,
    substitutes: undefined,
    active_substitute: undefined,
  };
  const all = [principal, ...item.substitutes];
  const activePos = item.active_substitute != null ? item.active_substitute + 1 : 0;
  const active = all[activePos] ?? principal;
  return [active, ...all.filter((o) => o !== active)];
}

/** Categorias correntes (com fallback para as padrão antes da semeadura). */
function categoriesForExport() {
  const cats = getRecipeCategories();
  return cats.length > 0 ? cats : DEFAULT_RECIPE_CATEGORIES;
}

function fmtNum(value: number | undefined | null, decimals = 1): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function categoryName(id: string): string {
  return categoriesForExport().find((c) => c.id === id)?.name ?? id;
}

function difficultyLabel(d: string): string {
  return { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }[d] ?? d;
}

function seasonLabel(s: string): string {
  return { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' }[s] ?? s;
}

/** Linha de metadados (tempo, dificuldade, avaliação, estação) da receita. */
function metaLine(recipe: Recipe): string {
  const parts: string[] = [];
  if (recipe.prep_time_min) parts.push(`⏱️ ${recipe.prep_time_min} min`);
  if (recipe.difficulty) parts.push(`📊 ${difficultyLabel(recipe.difficulty)}`);
  if (recipe.rating) parts.push('⭐'.repeat(recipe.rating));
  if (recipe.season) parts.push(`🗓️ ${seasonLabel(recipe.season)}`);
  return parts.join(' · ');
}

function ingredientLines(items: RecipeIngredient[]): string[] {
  return items.map((ing) => {
    const [active, ...alternatives] = ingredientOptions(ing);
    const optionalSuffix = ing.is_optional ? ' _(opcional)_' : '';
    if (alternatives.length === 0) return `- ${active.raw_text}${optionalSuffix}`;
    const alt = alternatives.map((o) => o.raw_text).join('; ');
    return `- ${active.raw_text} _(ou: ${alt})_${optionalSuffix}`;
  });
}

function stepsLines(steps: string[]): string[] {
  return steps.map((s, i) => `${i + 1}. ${s}`);
}

/** Bloco de nutrição estimada: total da receita + por 100 g quando disponível. */
function nutritionLines(recipe: Recipe): string[] {
  const items = [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])].map(
    activeIngredient,
  );
  if (items.length === 0) return [];
  const total = computeNutrition(items);
  if (total.counted === 0) return [];

  const t = total.totals;
  const lines: string[] = ['### Nutrição (estimada)', ''];
  lines.push('| Nutriente | Total da receita | Por 100 g |');
  lines.push('| --- | --- | --- |');

  const per100 = recipe.nutrition_per_100g
    ? (recipe.nutrition_per_100g as Partial<Record<keyof NutritionPer100, number>>)
    : recipeNutritionPer100g(recipe);

  const rows: { key: keyof NutritionPer100; label: string; unit: string }[] = [
    { key: 'calories', label: 'Calorias', unit: 'kcal' },
    { key: 'protein', label: 'Proteínas', unit: 'g' },
    { key: 'carbs', label: 'Carboidratos', unit: 'g' },
    { key: 'fat', label: 'Gorduras', unit: 'g' },
    { key: 'fiber', label: 'Fibras', unit: 'g' },
    { key: 'sodium', label: 'Sódio', unit: 'mg' },
  ];

  for (const { key, label, unit } of rows) {
    const totalVal = t[key];
    const per100Val = per100?.[key];
    if (totalVal == null && per100Val == null) continue;
    lines.push(
      `| ${label} | ${fmtNum(totalVal)} ${unit} | ${
        per100Val == null ? '—' : `${fmtNum(per100Val)} ${unit}`
      } |`,
    );
  }
  lines.push('');
  lines.push(
    `> Estimativa a partir de ${total.counted} ingrediente(s) com dados` +
      (total.skipped > 0 ? `; ${total.skipped} ignorado(s).` : '.'),
  );
  lines.push('');
  return lines;
}

/** Seção markdown de uma única receita. */
function recipeSection(recipe: Recipe): string {
  const lines: string[] = [];
  lines.push(`## ${recipe.name}`);
  lines.push('');

  const meta = metaLine(recipe);
  if (meta) {
    lines.push(meta);
    lines.push('');
  }

  // Categorias extras além da principal (que já vira o título do grupo).
  const cats = recipeCategoryIds(recipe);
  if (cats.length > 1) {
    lines.push(`_Categorias: ${cats.map(categoryName).join(', ')}_`);
    lines.push('');
  }

  if (recipe.needs_review) {
    lines.push('> ⚠️ Em revisão — ingredientes e modo de preparo ainda não totalmente estruturados.');
    lines.push('');
  }

  if (recipe.notes && recipe.notes.trim()) {
    lines.push(`_${recipe.notes.trim().replace(/\n/g, ' ')}_`);
    lines.push('');
  }

  if ((recipe.ingredients?.length ?? 0) > 0) {
    lines.push('### Ingredientes');
    lines.push('');
    lines.push(...ingredientLines(recipe.ingredients ?? []));
    lines.push('');
  }

  if ((recipe.ingredients_molho?.length ?? 0) > 0) {
    lines.push('### Ingredientes — molho');
    lines.push('');
    lines.push(...ingredientLines(recipe.ingredients_molho ?? []));
    lines.push('');
  }

  if ((recipe.steps?.length ?? 0) > 0) {
    lines.push('### Modo de preparo');
    lines.push('');
    lines.push(...stepsLines(recipe.steps ?? []));
    lines.push('');
  }

  if ((recipe.steps_natural?.length ?? 0) > 0) {
    lines.push('### Modo de preparo — natural');
    lines.push('');
    lines.push(...stepsLines(recipe.steps_natural ?? []));
    lines.push('');
  }

  if ((recipe.steps_congelada?.length ?? 0) > 0) {
    lines.push('### Modo de preparo — congelada');
    lines.push('');
    lines.push(...stepsLines(recipe.steps_congelada ?? []));
    lines.push('');
  }

  lines.push(...nutritionLines(recipe));

  if (recipe.source_url) {
    lines.push(`**Fonte:** ${recipe.source_url}`);
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}

/** Gera o conteúdo markdown de todas as receitas, agrupadas por categoria. */
export function buildRecipesMarkdown(recipes: Recipe[] = getAllRecipes()): string {
  const now = new Date();
  const header: string[] = [];
  header.push('# Livro de Receitas — App Alimentação');
  header.push('');
  header.push(`_Exportado em ${now.toLocaleString('pt-BR')}_`);
  header.push('');
  header.push(`Total de receitas: ${recipes.length}`);
  header.push('');

  if (recipes.length === 0) {
    header.push('_Nenhuma receita cadastrada._');
    return header.join('\n') + '\n';
  }

  // Agrupa por categoria na ordem do catálogo; categorias desconhecidas ao fim.
  const OUTRAS = '__outras__';
  const order: string[] = categoriesForExport().map((c) => c.id);
  const groups = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    const primary = primaryCategoryId(recipe);
    const key = order.includes(primary) ? primary : OUTRAS;
    const bucket = groups.get(key) ?? [];
    bucket.push(recipe);
    groups.set(key, bucket);
  }

  const orderedKeys = order.filter((k) => groups.has(k));
  if (groups.has(OUTRAS)) orderedKeys.push(OUTRAS);

  const sections: string[] = [];
  for (const key of orderedKeys) {
    const bucket = (groups.get(key) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    const name = key === OUTRAS ? 'Outras' : categoryName(key);
    sections.push(`# ${name}\n`);
    sections.push(bucket.map(recipeSection).join('\n---\n\n'));
  }

  return header.join('\n') + '\n' + sections.join('\n\n') + '\n';
}

/** Dispara o download do markdown com todas as receitas. Retorna a quantidade exportada. */
export function downloadRecipesMarkdown(recipes?: Recipe[]): number {
  const list = recipes ?? getAllRecipes();
  const markdown = buildRecipesMarkdown(list);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `livro-de-receitas-${date}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return list.length;
}
