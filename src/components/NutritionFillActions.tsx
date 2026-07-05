import { useState } from 'react';
import Icon from './Icon';
import NutritionPhotoImport from './NutritionPhotoImport';
import NutritionFillModal from './NutritionFillModal';
import type { NutritionSource } from './NutritionReview';
import { autoFillNutrition } from '../lib/autoNutrition';
import {
  estimateNutritionByName,
  geminiConfigured,
  type ExtractedNutrition,
} from '../lib/gemini';
import type { Ingredient } from '../types/ingredient';

type FillAction = 'auto' | 'ai';

type ActiveModal =
  | { kind: 'photo' }
  | {
      kind: 'fill';
      data: ExtractedNutrition;
      source: NutritionSource;
      matchName?: string;
      tacoId?: string;
      tbcaCode?: string;
      offBarcode?: string;
    }
  | null;

/**
 * Linha de ações para obter/revisar a tabela nutricional de um ingrediente:
 * base consolidada (TBCA → TACO → Open Food Facts), foto do rótulo ou estimativa por IA.
 * Os mesmos botões usados em "Dados a completar", reutilizáveis em outras telas
 * (ex.: edição do ingrediente). O usuário confere os valores antes de salvar.
 */
export default function NutritionFillActions({
  ingredient,
  onSaved,
}: {
  ingredient: Ingredient;
  onSaved?: () => void;
}) {
  const [modal, setModal] = useState<ActiveModal>(null);
  const [busy, setBusy] = useState<FillAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runAuto = async () => {
    setBusy('auto');
    setMessage(null);
    try {
      const res = await autoFillNutrition(ingredient);
      if (res) {
        setModal({
          kind: 'fill',
          data: res.data,
          source: res.source,
          matchName: res.matchName,
          tacoId: res.tacoId,
          tbcaCode: res.tbcaCode,
          offBarcode: res.offBarcode,
        });
      } else {
        setMessage(
          geminiConfigured
            ? 'Não achei na TBCA, na TACO nem no Open Food Facts. Use a foto ou a estimativa por IA.'
            : 'Não achei na TBCA, na TACO nem no Open Food Facts.',
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao buscar nas bases.');
    } finally {
      setBusy(null);
    }
  };

  const runAi = async () => {
    setBusy('ai');
    setMessage(null);
    try {
      const unit = ingredient.default_unit === 'ml' ? 'ml' : 'g';
      const data = await estimateNutritionByName(ingredient.name, ingredient.brand, unit);
      if (data.found) {
        setModal({ kind: 'fill', data, source: 'ai' });
      } else {
        setMessage('A IA não reconheceu este item. Tente a foto do rótulo.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha na estimativa por IA.');
    } finally {
      setBusy(null);
    }
  };

  const anyBusy = busy !== null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runAuto}
          disabled={anyBusy}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {busy === 'auto' ? (
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
              onClick={() => setModal({ kind: 'photo' })}
              disabled={anyBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              Escanear (foto)
            </button>
            <button
              type="button"
              onClick={runAi}
              disabled={anyBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              {busy === 'ai' ? (
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
      {message && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{message}</p>}

      {modal?.kind === 'photo' && (
        <NutritionPhotoImport
          ingredient={ingredient}
          open
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onSaved?.();
          }}
        />
      )}
      {modal?.kind === 'fill' && (
        <NutritionFillModal
          ingredient={ingredient}
          data={modal.data}
          source={modal.source}
          matchName={modal.matchName}
          tacoId={modal.tacoId}
          tbcaCode={modal.tbcaCode}
          offBarcode={modal.offBarcode}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}
