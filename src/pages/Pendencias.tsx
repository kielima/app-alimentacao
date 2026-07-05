import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import NutritionPhotoImport from '../components/NutritionPhotoImport';
import NutritionFillModal from '../components/NutritionFillModal';
import type { NutritionSource } from '../components/NutritionReview';
import { upsertUserIngredient } from '../data/userIngredients';
import { useDataGaps } from '../hooks/useDataGaps';
import { autoFillNutrition } from '../lib/autoNutrition';
import {
  estimateNutritionByName,
  estimateServingSize,
  geminiConfigured,
  type ExtractedNutrition,
} from '../lib/gemini';
import type { Ingredient } from '../types/ingredient';
import type { ServingGap } from '../utils/dataGaps';
import { unitLabel } from '../utils/units';

export default function Pendencias() {
  const gaps = useDataGaps();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Dados a completar</h1>
        {gaps.total > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {gaps.total}
          </span>
        )}
      </HeaderSlot>

      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Itens cujos dados faltam para o plano funcionar bem. Preencha a porção padrão aqui mesmo;
        para tabela nutricional, quantidades e validade, toque para abrir o item.
      </p>

      {gaps.total === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <Icon name="check-circle" className="mx-auto mb-2 h-7 w-7" />
          Tudo preenchido! Nenhum dado faltando para o cálculo nutricional.
        </div>
      ) : (
        <div className="space-y-6">
          <ServingGapSection gaps={gaps.ingredientsNoServing} />

          <NutritionGapSection ingredients={gaps.ingredientsNoNutrition} />

          <GapSection
            title="Refeições com itens sem quantidade"
            count={gaps.mealGaps.length}
            hint="Itens sem quantidade não entram na soma da refeição."
            emptyWhenZero
          >
            {gaps.mealGaps.map(({ meal, missingCount }) => (
              <GapRow
                key={meal.id}
                to={`/refeicoes/${meal.id}/editar`}
                title={meal.name}
                subtitle={`${missingCount} ${missingCount === 1 ? 'item sem quantidade' : 'itens sem quantidade'}`}
              />
            ))}
          </GapSection>

          <GapSection
            title="Receitas com itens sem quantidade"
            count={gaps.recipeGaps.length}
            hint="Itens sem quantidade não entram no cálculo da receita."
            emptyWhenZero
          >
            {gaps.recipeGaps.map(({ recipe, missingCount }) => (
              <GapRow
                key={recipe.id}
                to={`/receitas/${recipe.id}/editar`}
                title={recipe.name}
                subtitle={`${missingCount} ${missingCount === 1 ? 'item sem quantidade' : 'itens sem quantidade'}`}
              />
            ))}
          </GapSection>

          <GapSection
            title="Itens da dispensa sem validade"
            count={gaps.pantryNoExpiry.length}
            hint="Sem data de validade, não entram no controle de vencimento nem na priorização da montagem automática do plano."
            emptyWhenZero
          >
            {gaps.pantryNoExpiry.map((item) => (
              <GapRow
                key={item.id}
                to={`/dispensa/${item.id}/editar`}
                title={item.raw_text}
                subtitle="sem data de validade"
              />
            ))}
          </GapSection>
        </div>
      )}
    </div>
  );
}

function GapSection({
  title,
  count,
  hint,
  emptyWhenZero,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  emptyWhenZero?: boolean;
  children: React.ReactNode;
}) {
  if (emptyWhenZero && count === 0) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {count}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</p>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

type FillAction = 'auto' | 'ai';

type ActiveModal =
  | { kind: 'photo'; ingredient: Ingredient }
  | {
      kind: 'fill';
      ingredient: Ingredient;
      data: ExtractedNutrition;
      source: NutritionSource;
      matchName?: string;
      tacoId?: string;
      tbcaCode?: string;
      offBarcode?: string;
    }
  | null;

/**
 * Seção "Ingredientes sem tabela nutricional" com preenchimento em cascata:
 * TBCA → TACO → Open Food Facts (automático) e, se falhar, foto ou estimativa por IA.
 */
function NutritionGapSection({ ingredients }: { ingredients: Ingredient[] }) {
  const [modal, setModal] = useState<ActiveModal>(null);
  const [busy, setBusy] = useState<{ id: string; action: FillAction } | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  if (ingredients.length === 0) return null;

  const setMsg = (id: string, text: string) =>
    setMessages((prev) => ({ ...prev, [id]: text }));
  const clearMsg = (id: string) =>
    setMessages((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const runAuto = async (ing: Ingredient) => {
    setBusy({ id: ing.id, action: 'auto' });
    clearMsg(ing.id);
    try {
      const res = await autoFillNutrition(ing);
      if (res) {
        setModal({
          kind: 'fill',
          ingredient: ing,
          data: res.data,
          source: res.source,
          matchName: res.matchName,
          tacoId: res.tacoId,
          tbcaCode: res.tbcaCode,
          offBarcode: res.offBarcode,
        });
      } else {
        setMsg(
          ing.id,
          geminiConfigured
            ? 'Não achei na TBCA, na TACO nem no Open Food Facts. Use a foto ou a estimativa por IA.'
            : 'Não achei na TBCA, na TACO nem no Open Food Facts. Preencha pela página do ingrediente.',
        );
      }
    } catch (err) {
      setMsg(ing.id, err instanceof Error ? err.message : 'Falha ao buscar nas bases.');
    } finally {
      setBusy(null);
    }
  };

  const runAi = async (ing: Ingredient) => {
    setBusy({ id: ing.id, action: 'ai' });
    clearMsg(ing.id);
    try {
      const unit = ing.default_unit === 'ml' ? 'ml' : 'g';
      const data = await estimateNutritionByName(ing.name, ing.brand, unit);
      if (data.found) {
        setModal({ kind: 'fill', ingredient: ing, data, source: 'ai' });
      } else {
        setMsg(ing.id, 'A IA não reconheceu este item. Tente a foto do rótulo.');
      }
    } catch (err) {
      setMsg(ing.id, err instanceof Error ? err.message : 'Falha na estimativa por IA.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ingredientes sem tabela nutricional
        </h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {ingredients.length}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        Preencha por uma base consolidada (TBCA → TACO → Open Food Facts) ou, se não achar, por foto do
        rótulo ou estimativa por IA. Você confere os valores antes de salvar.
      </p>
      <ul className="space-y-1.5">
        {ingredients.map((ing) => (
          <NutritionGapRow
            key={ing.id}
            ingredient={ing}
            busyAction={busy?.id === ing.id ? busy.action : null}
            disabled={busy !== null && busy.id !== ing.id}
            message={messages[ing.id]}
            onAuto={() => runAuto(ing)}
            onPhoto={() => setModal({ kind: 'photo', ingredient: ing })}
            onAi={() => runAi(ing)}
          />
        ))}
      </ul>

      {modal?.kind === 'photo' && (
        <NutritionPhotoImport
          ingredient={modal.ingredient}
          open
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal?.kind === 'fill' && (
        <NutritionFillModal
          ingredient={modal.ingredient}
          data={modal.data}
          source={modal.source}
          matchName={modal.matchName}
          tacoId={modal.tacoId}
          tbcaCode={modal.tbcaCode}
          offBarcode={modal.offBarcode}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </section>
  );
}

function NutritionGapRow({
  ingredient,
  busyAction,
  disabled,
  message,
  onAuto,
  onPhoto,
  onAi,
}: {
  ingredient: Ingredient;
  busyAction: FillAction | null;
  disabled: boolean;
  message?: string;
  onAuto: () => void;
  onPhoto: () => void;
  onAi: () => void;
}) {
  const anyBusy = busyAction !== null;
  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        to={`/ingredientes/${ingredient.id}`}
        className="block truncate text-sm font-medium text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
      >
        {ingredient.brand ? `${ingredient.brand} — ${ingredient.name}` : ingredient.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAuto}
          disabled={disabled || anyBusy}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {busyAction === 'auto' ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Buscando…
            </>
          ) : (
            <>
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              Preencher automaticamente
            </>
          )}
        </button>
        {geminiConfigured && (
          <>
            <button
              type="button"
              onClick={onPhoto}
              disabled={disabled || anyBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              Escanear (foto)
            </button>
            <button
              type="button"
              onClick={onAi}
              disabled={disabled || anyBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              {busyAction === 'ai' ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-500" />
                  Estimando…
                </>
              ) : (
                <>
                  <Icon name="sparkles" className="h-3.5 w-3.5" />
                  Estimar com IA
                </>
              )}
            </button>
          </>
        )}
      </div>
      {message && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{message}</p>
      )}
    </li>
  );
}

function GapRow({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 hover:border-brand-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        </span>
        <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-zinc-400" />
      </Link>
    </li>
  );
}

function ServingGapSection({ gaps }: { gaps: ServingGap[] }) {
  if (gaps.length === 0) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ingredientes sem porção padrão (g)
        </h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {gaps.length}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        São usados em medidas como unidade/fatia. Informe quantas gramas tem 1 dessas medidas
        {geminiConfigured ? ' — ou deixe a IA estimar e confira o valor' : ''}.
      </p>
      <ul className="space-y-1.5">
        {gaps.map((gap) => (
          <ServingRow key={gap.ingredient.id} gap={gap} />
        ))}
      </ul>
    </section>
  );
}

function ServingRow({ gap }: { gap: ServingGap }) {
  const { ingredient, units } = gap;
  const unitSuffix = ingredient.default_unit === 'ml' ? 'ml' : 'g';
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  // Rótulos legíveis das medidas usadas (ex.: "fatia", "colher de sopa").
  const measureLabels = units.map(unitLabel).filter(Boolean);

  const save = () => {
    if (!valid) return;
    upsertUserIngredient({ ...ingredient, serving_size_g: parsed });
    setSaved(true);
  };

  const estimate = async () => {
    setEstimating(true);
    setMessage(null);
    try {
      const res = await estimateServingSize(ingredient.name, ingredient.brand, measureLabels);
      if (res.found && res.grams != null) {
        setValue(String(res.grams));
        setSaved(false);
        const measure = res.measureLabel ? ` (${res.measureLabel})` : '';
        setMessage(`Estimativa da IA: ${res.grams} ${unitSuffix}${measure}. Confira e ajuste antes de salvar.`);
      } else {
        setMessage('A IA não conseguiu estimar. Preencha o valor manualmente.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha na estimativa por IA.');
    } finally {
      setEstimating(false);
    }
  };

  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={`/ingredientes/${ingredient.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
        >
          {ingredient.brand ? `${ingredient.brand} — ${ingredient.name}` : ingredient.name}
        </Link>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-3.5 w-3.5" /> salvo
          </span>
        )}
      </div>
      {measureLabels.length > 0 && (
        <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          Usado como: {measureLabels.join(', ')}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">1 medida =</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Ex.: 50"
          className="w-20 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{unitSuffix}</span>
        <button
          type="button"
          onClick={save}
          disabled={!valid}
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar
        </button>
      </div>
      {geminiConfigured && (
        <div className="mt-2">
          <button
            type="button"
            onClick={estimate}
            disabled={estimating}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {estimating ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-500" />
                Estimando…
              </>
            ) : (
              <>
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                Estimar com IA
              </>
            )}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{message}</p>}
    </li>
  );
}
