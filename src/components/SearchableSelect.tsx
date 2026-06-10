import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export interface SearchableOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  createLabel?: string | ((query: string) => string);
  onCreate?: (query?: string) => void;
  createMode?: 'always' | 'whenEmpty';
  className?: string;
}

const baseClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '— Selecione —',
  createLabel,
  onCreate,
  createMode = 'always',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {open ? (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          autoFocus
          className={baseClass}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${baseClass} flex items-center justify-between gap-2 text-left ${
            value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <Icon name="chevron-down" className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
      )}

      {open && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {filtered.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  opt.value === value
                    ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-zinc-800 dark:text-zinc-100'
                }`}
              >
                {opt.label}
              </button>
            </li>
          ))}
          {(() => {
            const showCreate =
              !!createLabel &&
              (createMode === 'always' ||
                (filtered.length === 0 && query.trim() !== ''));
            const resolvedLabel = showCreate
              ? typeof createLabel === 'function'
                ? createLabel(query)
                : createLabel
              : null;
            const showEmptyMessage =
              filtered.length === 0 && (createMode === 'always' || !showCreate);
            return (
              <>
                {showEmptyMessage && (
                  <li className="px-3 py-2.5 text-sm text-zinc-400 dark:text-zinc-500">
                    Nenhum resultado
                  </li>
                )}
                {showCreate && resolvedLabel && (
                  <li className="border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const q = query;
                        close();
                        onCreate?.(q);
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                    >
                      {resolvedLabel}
                    </button>
                  </li>
                )}
              </>
            );
          })()}
        </ul>
      )}
    </div>
  );
}
