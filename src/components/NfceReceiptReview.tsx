import { useState } from 'react';
import Icon from './Icon';
import SearchableSelect from './SearchableSelect';
import { UNIT_OPTIONS } from '../utils/units';
import { buildNfceReviewRows, applyNfceReview, type NfceReviewRow } from '../lib/nfceActions';
import { itemDisplayName, type DispensaItem } from '../hooks/useDispensa';
import type { ExtractedNfce } from '../lib/nfce';

interface Props {
  data: ExtractedNfce;
  comprarItems: DispensaItem[];
  onApply: () => void;
  onCancel: () => void;
}

const inputClass =
  'rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none';

export default function NfceReceiptReview({ data, comprarItems, onApply, onCancel }: Props) {
  const [rows, setRows] = useState<NfceReviewRow[]>(() =>
    buildNfceReviewRows(data, comprarItems),
  );

  const updateRow = (key: string, patch: Partial<NfceReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const targetOptions = [
    { value: '', label: '— Criar novo item —' },
    ...comprarItems.map((i) => ({ value: `${i.kind}:${i.data.id}`, label: itemDisplayName(i) })),
  ];

  const includedCount = rows.filter((r) => r.include).length;

  const handleApply = () => {
    applyNfceReview(rows, comprarItems, data.market);
    onApply();
  };

  return (
    <div className="mx-auto max-w-md text-zinc-100">
      {data.market?.name && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-zinc-300">
          <Icon name="store" className="h-4 w-4 shrink-0" />
          <span className="truncate">{data.market.name}</span>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg bg-zinc-800/60 p-3 text-sm text-zinc-300">
          Não encontrei itens legíveis nessa nota.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="rounded-xl bg-zinc-900 p-3">
              <div className="mb-2 flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => updateRow(row.key, { include: !row.include })}
                  aria-label={row.include ? 'Excluir da aplicação' : 'Incluir na aplicação'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    row.include
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-zinc-600 text-transparent'
                  }`}
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                </button>
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => updateRow(row.key, { description: e.target.value })}
                  className={`min-w-0 flex-1 ${inputClass}`}
                />
              </div>
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={row.quantity ?? ''}
                  onChange={(e) =>
                    updateRow(row.key, {
                      quantity: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Qtd"
                  className={inputClass}
                />
                <select
                  value={row.unit ?? ''}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value || null })}
                  className={inputClass}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={row.price ?? ''}
                  onChange={(e) =>
                    updateRow(row.key, { price: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="R$"
                  className={inputClass}
                />
              </div>
              <SearchableSelect
                value={row.targetId ?? ''}
                onChange={(v) => updateRow(row.key, { targetId: v || null })}
                options={targetOptions}
                placeholder="— Criar novo item —"
                className="text-sm"
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={includedCount === 0}
          className="flex-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Aplicar {includedCount > 0 ? `(${includedCount})` : ''}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
