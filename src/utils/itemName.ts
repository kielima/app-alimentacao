import { findIngredientById } from '../data/ingredients';

/** Nome de exibição "Marca — Nome" (ou só o nome, sem marca) de um ingrediente. */
export function ingredientDisplayName(ing: { name: string; brand?: string | null }): string {
  return ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
}

/**
 * Nome de exibição de um item vinculado a um ingrediente (item da dispensa,
 * da lista de compras ou de uma receita/refeição). `raw_text` é uma cópia do
 * nome congelada no momento em que o item foi criado/editado; ao renomear o
 * ingrediente no catálogo, ela não é atualizada em outros itens que apontam
 * para o mesmo `ingredient_id`. Por isso a exibição sempre prefere o nome
 * atual do ingrediente vinculado, caindo para `raw_text` só quando o item não
 * tem vínculo (ex.: item de casa) ou o ingrediente vinculado foi apagado.
 */
export function resolveItemName(item: {
  ingredient_id?: string | null;
  raw_text: string;
}): string {
  const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
  return ing ? ingredientDisplayName(ing) : item.raw_text;
}
