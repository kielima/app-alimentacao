import { type ReactNode } from 'react';

export interface CardActionSheetAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface CardActionSheetProps {
  category: string;
  title: string;
  actions: CardActionSheetAction[];
  onClose: () => void;
}

export default function CardActionSheet({
  category,
  title,
  actions,
  onClose,
}: CardActionSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ações de ${category}`}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative mx-auto w-full max-w-md p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {category}
            </p>
            <p className="truncate text-base font-medium">{title}</p>
          </div>
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                i > 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : ''
              } ${action.destructive ? 'text-red-600 dark:text-red-400' : ''}`}
            >
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center">
                {action.icon}
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl bg-white py-3 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
