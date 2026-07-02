import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import TrashIcon from '../components/TrashIcon';
import { useAllIngredients } from '../data/ingredients';
import { recipeCategories } from '../data/recipes';
import { upsertUserRecipe } from '../data/userRecipes';
import { extractRecipe, extractedToRecipe } from '../lib/recipeImport';
import type { Recipe, RecipeCategoryId } from '../types/recipe';

/** Extrai a primeira URL http(s) de um texto (o share do Android às vezes manda
 *  a URL dentro de `text`, com texto extra). */
function firstUrl(...candidates: (string | null)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(/https?:\/\/[^\s]+/i);
    if (m) return m[0];
    if (/^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return '';
}

type Stage =
  | { kind: 'input' }
  | { kind: 'loading' }
  | { kind: 'review'; recipe: Recipe }
  | { kind: 'error'; message: string };

export default function ReceitaImportar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ingredients = useAllIngredients();

  const initialUrl = useMemo(
    () => firstUrl(searchParams.get('url'), searchParams.get('text')),
    [searchParams],
  );

  const [stage, setStage] = useState<Stage>({ kind: 'input' });
  const [mode, setMode] = useState<'link' | 'text'>('link');
  const [url, setUrl] = useState(initialUrl);
  const [pastedText, setPastedText] = useState('');

  const runImport = async () => {
    const input =
      mode === 'link' ? { url: url.trim() } : { text: pastedText.trim() };
    if (mode === 'link' && !input.url) return;
    if (mode === 'text' && !input.text) return;

    setStage({ kind: 'loading' });
    try {
      const data = await extractRecipe(input);
      if (!data.found) {
        setStage({
          kind: 'error',
          message:
            'Não encontrei uma receita nesse conteúdo. Se for um Reel/TikTok, tente o modo "colar texto" com a legenda do post.',
        });
        return;
      }
      setStage({ kind: 'review', recipe: extractedToRecipe(data, ingredients) });
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao importar a receita.',
      });
    }
  };

  const handleSubmitInput = (e: FormEvent) => {
    e.preventDefault();
    runImport();
  };

  const handleSave = (recipe: Recipe) => {
    upsertUserRecipe(recipe);
    navigate(`/receitas/${recipe.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Importar receita</h1>
      </HeaderSlot>

      {stage.kind === 'input' && (
        <form onSubmit={handleSubmitInput}>
          <div className="mb-4 mt-2 flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300">
              <Icon name="sparkles" className="h-8 w-8" />
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Cole um link do <span className="font-medium">YouTube</span>,{' '}
              <span className="font-medium">TikTok</span>,{' '}
              <span className="font-medium">Instagram</span> ou de uma página de receita. A IA lê o
              conteúdo e monta a receita para você conferir.
            </p>
          </div>

          <div className="mb-4 flex overflow-hidden rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
            {(['link', 'text'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {m === 'link' ? 'Link' : 'Colar texto'}
              </button>
            ))}
          </div>

          {mode === 'link' ? (
            <input
              type="url"
              inputMode="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          ) : (
            <textarea
              autoFocus
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={8}
              placeholder="Cole aqui a legenda ou a descrição da receita…"
              className={inputClass}
            />
          )}

          {mode === 'text' && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Use isto quando o link falhar (Instagram costuma exigir isso) — cole a legenda do post
              com os ingredientes e o preparo.
            </p>
          )}

          <button
            type="submit"
            disabled={mode === 'link' ? !url.trim() : !pastedText.trim()}
            className="mt-5 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Importar receita
          </button>

          <div className="mt-4 text-center">
            <Link
              to="/receitas/nova"
              className="text-sm text-zinc-500 underline hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
            >
              Ou criar manualmente
            </Link>
          </div>
        </form>
      )}

      {stage.kind === 'loading' && (
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-brand-500 dark:border-zinc-700 dark:border-t-brand-400" />
          <p className="text-sm text-zinc-700 dark:text-zinc-200">Lendo a receita do link…</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pode levar até um minuto para vídeos.
          </p>
        </div>
      )}

      {stage.kind === 'error' && (
        <div className="mt-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <Icon name="alert-triangle" className="h-7 w-7" />
          </div>
          <p className="mb-6 text-sm text-zinc-700 dark:text-zinc-200">{stage.message}</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStage({ kind: 'input' })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Icon name="rotate-ccw" className="h-4 w-4" /> Tentar de novo
            </button>
            <Link
              to="/receitas/nova"
              className="text-sm text-zinc-500 underline hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
            >
              Criar manualmente
            </Link>
          </div>
        </div>
      )}

      {stage.kind === 'review' && (
        <ReviewForm
          recipe={stage.recipe}
          onSave={handleSave}
          onDiscard={() => setStage({ kind: 'input' })}
        />
      )}
    </div>
  );
}

function ReviewForm({
  recipe,
  onSave,
  onDiscard,
}: {
  recipe: Recipe;
  onSave: (recipe: Recipe) => void;
  onDiscard: () => void;
}) {
  const [name, setName] = useState(recipe.name);
  const [category, setCategory] = useState<RecipeCategoryId>(recipe.category);
  const [prepTime, setPrepTime] = useState(recipe.prep_time_min?.toString() ?? '');
  // Mantém ingredient_id/quantity/unit sob o capô; usuário edita o texto.
  const [ingredients, setIngredients] = useState(recipe.ingredients ?? []);
  const [steps, setSteps] = useState(recipe.steps ?? []);
  const matchedCount = ingredients.filter((i) => i.ingredient_id).length;

  const updateIngredient = (idx: number, raw_text: string) =>
    setIngredients((list) => list.map((it, i) => (i === idx ? { ...it, raw_text } : it)));
  const removeIngredient = (idx: number) =>
    setIngredients((list) => list.filter((_, i) => i !== idx));
  const addIngredient = () =>
    setIngredients((list) => [
      ...list,
      { raw_text: '', ingredient_id: null, quantity: null, unit: null },
    ]);

  const updateStep = (idx: number, value: string) =>
    setSteps((list) => list.map((s, i) => (i === idx ? value : s)));
  const removeStep = (idx: number) => setSteps((list) => list.filter((_, i) => i !== idx));
  const addStep = () => setSteps((list) => [...list, '']);

  const handleSave = () => {
    const cleanedIngredients = ingredients
      .map((i) => ({ ...i, raw_text: i.raw_text.trim() }))
      .filter((i) => i.raw_text);
    const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
    onSave({
      ...recipe,
      name: name.trim() || 'Receita importada',
      category,
      prep_time_min: prepTime ? Number(prepTime) : null,
      ingredients: cleanedIngredients,
      steps: cleanedSteps,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
        <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Confira e ajuste antes de salvar — a leitura automática pode falhar.
          {matchedCount > 0 && ` ${matchedCount} ingrediente(s) casaram com o seu catálogo.`}
        </span>
      </div>

      <Field label="Nome">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RecipeCategoryId)}
            className={inputClass}
          >
            {recipeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tempo (min)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="—"
            className={inputClass}
          />
        </Field>
      </div>

      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ingredientes
        </h2>
        <ul className="space-y-2">
          {ingredients.map((ing, idx) => (
            <li key={idx} className="flex items-center gap-2">
              {ing.ingredient_id && (
                <span
                  className="shrink-0 text-emerald-500"
                  title="Reconhecido no seu catálogo"
                  aria-label="Reconhecido no seu catálogo"
                >
                  <Icon name="check-circle" className="h-4 w-4" />
                </span>
              )}
              <input
                type="text"
                value={ing.raw_text}
                onChange={(e) => updateIngredient(idx, e.target.value)}
                className={`${inputClass} text-sm`}
                placeholder="Ex.: 2 xícaras de farinha"
              />
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                className="shrink-0 rounded-md bg-red-100 px-2 py-1.5 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                aria-label="Remover ingrediente"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addIngredient}
          className="mt-2 w-full rounded-xl border-2 border-dashed border-zinc-300 py-2.5 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
        >
          + Adicionar ingrediente
        </button>
      </section>

      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Modo de preparo
        </h2>
        <ul className="space-y-2">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {idx + 1}
              </span>
              <textarea
                value={step}
                onChange={(e) => updateStep(idx, e.target.value)}
                rows={2}
                className={`${inputClass} text-sm`}
                placeholder={`Passo ${idx + 1}…`}
              />
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="mt-1 shrink-0 rounded-md bg-red-100 px-2 py-1.5 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                aria-label="Remover passo"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addStep}
          className="mt-2 w-full rounded-xl border-2 border-dashed border-zinc-300 py-2.5 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
        >
          + Adicionar passo
        </button>
      </section>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full bg-zinc-100 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar receita
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';
