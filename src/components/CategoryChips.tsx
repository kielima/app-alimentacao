import Icon from './Icon';
import type { RecipeCategory } from '../data/recipeCategories';

/**
 * Seletor de categorias em chips (multi-seleção). Uma receita pode pertencer a
 * mais de uma categoria. Também mostra chips de categorias "órfãs" (ids que já
 * não existem na lista, ex.: categoria apagada) para não perdê-las em silêncio.
 */
export default function CategoryChips({
  categories,
  selected,
  onToggle,
}: {
  categories: RecipeCategory[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  // Ids selecionados que não estão mais na lista de categorias.
  const orphanIds = selected.filter((id) => categories.every((c) => c.id !== id));

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const active = selected.includes(c.id);
        return (
          <Chip key={c.id} active={active} onClick={() => onToggle(c.id)}>
            <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.name}
          </Chip>
        );
      })}
      {orphanIds.map((id) => (
        <Chip key={id} active onClick={() => onToggle(id)}>
          Sem categoria
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
      }`}
    >
      {active && <Icon name="check" className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  );
}
