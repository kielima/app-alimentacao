import { getUserProfile } from '../data/userProfile';
import { getUserRecipes } from '../data/userRecipes';
import { getUserMeals } from '../data/userMeals';
import { getUserIngredients } from '../data/userIngredients';
import { getPantry } from '../data/pantry';
import { getMarkets } from '../data/markets';
import { getMealPlans } from '../data/mealPlan';
import { getShoppingList } from '../data/shoppingList';
import { getOffContributions } from '../data/offContributions';
import { getHiddenIngredients } from '../data/hiddenIngredients';
import { getHiddenRecipes } from '../data/hiddenRecipes';

export const EXPORT_VERSION = 1;

export interface ExportPayload {
  version: number;
  exportedAt: string;
  app: string;
  data: {
    userProfile: ReturnType<typeof getUserProfile>;
    userRecipes: ReturnType<typeof getUserRecipes>;
    userMeals: ReturnType<typeof getUserMeals>;
    userIngredients: ReturnType<typeof getUserIngredients>;
    pantry: ReturnType<typeof getPantry>;
    markets: ReturnType<typeof getMarkets>;
    mealPlans: ReturnType<typeof getMealPlans>;
    shoppingList: ReturnType<typeof getShoppingList>;
    offContributions: ReturnType<typeof getOffContributions>;
    hiddenIngredients: ReturnType<typeof getHiddenIngredients>;
    hiddenRecipes: ReturnType<typeof getHiddenRecipes>;
  };
}

export function buildExportPayload(): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'app-alimentacao',
    data: {
      userProfile: getUserProfile(),
      userRecipes: getUserRecipes(),
      userMeals: getUserMeals(),
      userIngredients: getUserIngredients(),
      pantry: getPantry(),
      markets: getMarkets(),
      mealPlans: getMealPlans(),
      shoppingList: getShoppingList(),
      offContributions: getOffContributions(),
      hiddenIngredients: getHiddenIngredients(),
      hiddenRecipes: getHiddenRecipes(),
    },
  };
}

export function exportSummary(payload: ExportPayload): Record<string, number> {
  const d = payload.data;
  return {
    receitas: d.userRecipes.length,
    refeicoes: d.userMeals.length,
    ingredientes: d.userIngredients.length,
    dispensa: d.pantry.length,
    mercados: d.markets.length,
    plano: d.mealPlans.length,
    compras: d.shoppingList.length,
    contribuicoesOff: d.offContributions.length,
    receitasOcultas: d.hiddenRecipes.length,
    ingredientesOcultos: d.hiddenIngredients.length,
  };
}

export function downloadExport(payload: ExportPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = payload.exportedAt.slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `app-alimentacao-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
