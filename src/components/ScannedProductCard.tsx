import type { OffLookupResult } from '../lib/openFoodFacts';

export type ScanAction =
  | 'add-shopping'
  | 'add-pantry'
  | 'create-ingredient'
  | 'manual-not-found';

const ACTION_LABELS: Record<ScanAction, { label: string; icon: string }> = {
  'add-shopping': { label: 'Adicionar à lista de compras', icon: '🛒' },
  'add-pantry': { label: 'Adicionar à dispensa', icon: '🥫' },
  'create-ingredient': { label: 'Salvar como ingrediente', icon: '➕' },
  'manual-not-found': { label: 'Cadastrar manualmente', icon: '✍️' },
};

interface Props {
  barcode: string;
  lookup: OffLookupResult;
  actions: ScanAction[];
  error: string | null;
  onAction: (action: ScanAction) => void;
  onScanAgain: () => void;
}

export default function ScannedProductCard({
  barcode,
  lookup,
  actions,
  error,
  onAction,
  onScanAgain,
}: Props) {
  const product = lookup.product;
  const found = lookup.found && !!product;

  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-zinc-900 p-4 text-zinc-100">
      <p className="mb-1 font-mono text-xs text-zinc-400">{barcode}</p>

      {found ? (
        <div className="mb-4 flex gap-3">
          {product?.imageSmallUrl || product?.imageUrl ? (
            <img
              src={product.imageSmallUrl || product.imageUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-lg bg-zinc-800 object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-3xl">
              📦
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product?.name || '(sem nome)'}</p>
            {product?.brands && (
              <p className="truncate text-xs text-zinc-400">{product.brands}</p>
            )}
            {product?.nutrition?.calories != null && (
              <p className="mt-1 text-xs text-zinc-400">
                {product.nutrition.calories} kcal/100g · {product.nutrition.protein ?? 0}g prot ·{' '}
                {product.nutrition.carbs ?? 0}g carb · {product.nutrition.fat ?? 0}g gord
              </p>
            )}
            {product && !product.nutrition && (
              <p className="mt-1 text-xs text-amber-400">Sem dados nutricionais no OFF.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg bg-zinc-800/60 p-3 text-sm text-zinc-300">
          <p className="mb-1 font-medium">Produto não está no Open Food Facts.</p>
          <p className="text-xs text-zinc-400">
            Você pode cadastrar manualmente e, opcionalmente, salvar um rascunho pra contribuir
            pro OFF depois.
          </p>
        </div>
      )}

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {actions.map((action) => {
          const label = ACTION_LABELS[action];
          const isManual = action === 'manual-not-found';
          if (isManual && found) return null;
          if (!isManual && !found) return null;
          return (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              className="flex w-full items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <span aria-hidden>{label.icon}</span>
              {label.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onScanAgain}
          className="w-full rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Escanear outro
        </button>
      </div>
    </div>
  );
}
