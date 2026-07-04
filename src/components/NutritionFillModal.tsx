import Icon from './Icon';
import NutritionReview, { type NutritionSource } from './NutritionReview';
import type { ExtractedNutrition } from '../lib/gemini';
import type { Ingredient } from '../types/ingredient';

interface Props {
  ingredient: Ingredient;
  /** Valores já obtidos (cascata TACO/OFF ou estimativa da IA), por 100 g/ml. */
  data: ExtractedNutrition;
  source: NutritionSource;
  matchName?: string;
  tacoId?: string;
  offBarcode?: string;
  onSaved?: () => void;
  onClose: () => void;
}

/**
 * Modal em tela cheia para revisar e salvar uma tabela nutricional já obtida de
 * uma fonte automática (TACO / Open Food Facts) ou de estimativa por IA.
 * A busca/estimativa acontece antes de abrir; aqui é só revisão + salvar.
 */
export default function NutritionFillModal({
  ingredient,
  data,
  source,
  matchName,
  tacoId,
  offBarcode,
  onSaved,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
        <h2 className="flex-1 truncate text-base font-semibold text-zinc-100">
          Tabela nutricional — {ingredient.name}
        </h2>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md flex-1 overflow-y-auto px-4 pb-8">
        <NutritionReview
          ingredient={ingredient}
          data={data}
          source={source}
          matchName={matchName}
          tacoId={tacoId}
          offBarcode={offBarcode}
          onSaved={onSaved}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
