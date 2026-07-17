/** Nome de exibição "Marca — Nome" (ou só o nome, sem marca) de um ingrediente. */
export function ingredientDisplayName(ing: { name: string; brand?: string | null }): string {
  return ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
}
