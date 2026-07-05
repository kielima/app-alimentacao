import Icon from './Icon';
import { MEAL_TYPES, type MealType } from '../types/mealPlan';

/**
 * Seletor de horários (slots) em chips, multi-seleção. Usado por refeições,
 * receitas e ingredientes para etiquetar em quais horários o item pode entrar na
 * montagem automática do plano. Vazio = serve qualquer horário.
 */
export default function MealTypeChips({
  value,
  onChange,
}: {
  value: MealType[];
  onChange: (next: MealType[]) => void;
}) {
  const toggle = (mt: MealType) =>
    onChange(value.includes(mt) ? value.filter((t) => t !== mt) : [...value, mt]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {MEAL_TYPES.map((m) => {
        const active = value.includes(m.value);
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => toggle(m.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-brand-500 text-white dark:bg-brand-600'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Icon name={m.icon} className="h-3.5 w-3.5" /> {m.label}
          </button>
        );
      })}
    </div>
  );
}
