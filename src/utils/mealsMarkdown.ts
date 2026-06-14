import { findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import { getUserMeals } from '../data/userMeals';
import { getMealSlots, type Meal, type MealItem } from '../types/meal';
import type { NutritionPer100 } from '../types/ingredient';
import { MEAL_TYPES } from '../types/mealPlan';
import { computeMealItemsNutrition } from './nutrition';

function slotLabel(value: string): string {
  return MEAL_TYPES.find((m) => m.value === value)?.label ?? value;
}

function fmtNum(value: number | undefined, decimals = 1): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function fmtQuantity(item: Pick<MealItem, 'quantity' | 'unit'>): string {
  if (item.quantity == null) return '—';
  return `${fmtNum(item.quantity, 2)}${item.unit ? ` ${item.unit}` : ''}`;
}

/** Linha de macros principais a partir de um total de nutrição. */
function macroLine(totals: Partial<Record<keyof NutritionPer100, number>>): string {
  return (
    `${fmtNum(totals.calories, 0)} kcal · ` +
    `P ${fmtNum(totals.protein)} g · ` +
    `C ${fmtNum(totals.carbs)} g · ` +
    `G ${fmtNum(totals.fat)} g`
  );
}

function itemName(item: MealItem): string {
  if (item.kind === 'recipe' && item.recipe_id) {
    const recipe = findRecipeById(item.recipe_id);
    return recipe ? recipe.name : 'Receita não encontrada';
  }
  if (item.kind === 'ingredient' && item.ingredient_id) {
    const ing = findIngredientById(item.ingredient_id);
    if (!ing) return 'Ingrediente não encontrado';
    return ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
  }
  return 'Item sem vínculo';
}

function itemKindLabel(item: MealItem): string {
  return item.kind === 'recipe' ? 'Receita' : 'Ingrediente';
}

/** Expande os ingredientes de uma receita como sub-itens de composição. */
function recipeIngredientLines(recipeId: string): string[] {
  const recipe = findRecipeById(recipeId);
  if (!recipe?.ingredients || recipe.ingredients.length === 0) return [];
  return recipe.ingredients.map((ing) => {
    const name = ing.ingredient_id
      ? (findIngredientById(ing.ingredient_id)?.name ?? ing.raw_text)
      : ing.raw_text;
    const qty =
      ing.quantity != null ? ` — ${fmtNum(ing.quantity, 2)}${ing.unit ? ` ${ing.unit}` : ''}` : '';
    return `    - ${name}${qty}`;
  });
}

function mealSection(meal: Meal, index: number): string {
  const lines: string[] = [];
  lines.push(`## ${index}. ${meal.name}`);
  lines.push('');

  const slots = getMealSlots(meal);
  if (slots.length > 0) {
    lines.push(`**Slots:** ${slots.map(slotLabel).join(', ')}`);
    lines.push('');
  }

  if (meal.notes && meal.notes.trim()) {
    lines.push(`**Observações:** ${meal.notes.trim().replace(/\n/g, ' ')}`);
    lines.push('');
  }

  lines.push('### Composição');
  lines.push('');

  if (meal.items.length === 0) {
    lines.push('_Sem itens._');
    lines.push('');
  } else {
    lines.push('| # | Item | Tipo | Quantidade | Nutrição |');
    lines.push('| --- | --- | --- | --- | --- |');
    meal.items.forEach((item, i) => {
      const itemNutri = computeMealItemsNutrition([item]);
      const nutriCell = itemNutri.counted > 0 ? macroLine(itemNutri.totals) : '_sem dados_';
      lines.push(
        `| ${i + 1} | ${itemName(item)} | ${itemKindLabel(item)} | ${fmtQuantity(item)} | ${nutriCell} |`,
      );
    });
    lines.push('');

    // Detalhamento dos ingredientes de cada receita usada na refeição.
    const recipeItems = meal.items.filter(
      (it): it is MealItem & { recipe_id: string } =>
        it.kind === 'recipe' && !!it.recipe_id && recipeIngredientLines(it.recipe_id).length > 0,
    );
    if (recipeItems.length > 0) {
      lines.push('#### Ingredientes das receitas');
      lines.push('');
      for (const item of recipeItems) {
        lines.push(`- **${itemName(item)}**`);
        lines.push(...recipeIngredientLines(item.recipe_id));
      }
      lines.push('');
    }
  }

  const nutrition = computeMealItemsNutrition(meal.items);
  if (nutrition.counted > 0) {
    const t = nutrition.totals;
    lines.push('### Totais nutricionais');
    lines.push('');
    lines.push(`- **Calorias:** ${fmtNum(t.calories, 0)} kcal`);
    lines.push(`- **Proteína:** ${fmtNum(t.protein)} g`);
    lines.push(`- **Carboidratos:** ${fmtNum(t.carbs)} g`);
    if (t.sugars != null) lines.push(`- **Açúcares:** ${fmtNum(t.sugars)} g`);
    lines.push(`- **Gordura:** ${fmtNum(t.fat)} g`);
    if (t.saturated_fat != null) lines.push(`- **Gordura saturada:** ${fmtNum(t.saturated_fat)} g`);
    if (t.fiber != null) lines.push(`- **Fibra:** ${fmtNum(t.fiber)} g`);
    if (t.sodium != null) lines.push(`- **Sódio:** ${fmtNum(t.sodium)} mg`);
    if (nutrition.skipped > 0) {
      lines.push('');
      lines.push(`> ${nutrition.skipped} item(ns) sem dados nutricionais completos.`);
    }
    lines.push('');
  } else if (meal.items.length > 0) {
    lines.push('### Totais nutricionais');
    lines.push('');
    lines.push('_Sem dados nutricionais suficientes para calcular._');
    lines.push('');
  }

  return lines.join('\n');
}

/** Gera o conteúdo markdown com todas as refeições e suas composições completas. */
export function buildMealsMarkdown(meals: Meal[] = getUserMeals()): string {
  const now = new Date();
  const header: string[] = [];
  header.push('# Refeições — App Alimentação');
  header.push('');
  header.push(`_Exportado em ${now.toLocaleString('pt-BR')}_`);
  header.push('');
  header.push(`Total de refeições: ${meals.length}`);
  header.push('');

  if (meals.length === 0) {
    header.push('_Nenhuma refeição cadastrada._');
    return header.join('\n') + '\n';
  }

  const sorted = [...meals].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const sections = sorted.map((meal, i) => mealSection(meal, i + 1));

  return header.join('\n') + '\n' + sections.join('\n---\n\n') + '\n';
}

/** Dispara o download do markdown das refeições. */
export function downloadMealsMarkdown(meals?: Meal[]): number {
  const list = meals ?? getUserMeals();
  const markdown = buildMealsMarkdown(list);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `app-alimentacao-refeicoes-${date}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return list.length;
}
