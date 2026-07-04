import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import NutritionReview from './NutritionReview';
import { extractNutritionFromImage, type ExtractedNutrition } from '../lib/gemini';
import type { Ingredient } from '../types/ingredient';

interface Props {
  ingredient: Ingredient;
  open: boolean;
  onClose: () => void;
  /** Chamado após salvar com sucesso os valores no ingrediente. */
  onSaved?: () => void;
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'loading' }
  | { kind: 'review'; data: ExtractedNutrition }
  | { kind: 'error'; message: string };

export default function NutritionPhotoImport({ ingredient, open, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setStage({ kind: 'pick' });
  }, [open]);

  if (!open) return null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStage({ kind: 'loading' });
    try {
      const data = await extractNutritionFromImage(file);
      if (!data.found) {
        setStage({
          kind: 'error',
          message:
            'Não encontrei uma tabela nutricional legível na imagem. Tente uma foto mais nítida e enquadrada na tabela.',
        });
        return;
      }
      setStage({ kind: 'review', data });
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao ler a imagem.',
      });
    }
  };

  const unitSuffix = ingredient.default_unit === 'ml' ? 'ml' : 'g';

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
          Ler tabela nutricional
        </h2>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md flex-1 overflow-y-auto px-4 pb-8">
        {/* Inputs de arquivo escondidos — acionados pelos botões. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {stage.kind === 'pick' && (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
              <Icon name="sparkles" className="h-8 w-8" />
            </div>
            <p className="mb-1 text-sm text-zinc-200">
              Tire uma foto ou anexe uma imagem da tabela nutricional.
            </p>
            <p className="mb-6 text-xs text-zinc-400">
              A IA do Google Gemini vai ler os valores e você confere antes de salvar em{' '}
              <span className="font-medium text-zinc-200">{ingredient.name}</span>.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-600"
              >
                <Icon name="sparkles" className="h-5 w-5" />
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
              >
                <Icon name="upload" className="h-5 w-5" />
                Anexar imagem
              </button>
            </div>
            <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
              Dica: aproxime a câmera da tabela, com boa iluminação e sem reflexo. Use a coluna “por
              100 {unitSuffix}” quando o rótulo tiver.
            </p>
          </div>
        )}

        {stage.kind === 'loading' && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-brand-400" />
            <p className="text-sm text-zinc-300">Lendo a tabela nutricional…</p>
            <p className="mt-1 text-xs text-zinc-500">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {stage.kind === 'error' && (
          <div className="mt-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Icon name="alert-triangle" className="h-7 w-7" />
            </div>
            <p className="mb-6 text-sm text-zinc-200">{stage.message}</p>
            <button
              type="button"
              onClick={() => setStage({ kind: 'pick' })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Icon name="rotate-ccw" className="h-4 w-4" />
              Tentar de novo
            </button>
          </div>
        )}

        {stage.kind === 'review' && (
          <NutritionReview
            ingredient={ingredient}
            data={stage.data}
            source="photo"
            backLabel="Outra foto"
            onBack={() => setStage({ kind: 'pick' })}
            onSaved={onSaved}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
