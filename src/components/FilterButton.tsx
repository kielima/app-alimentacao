interface Props {
  active: boolean;
  hasActiveFilters: boolean;
  onClick: () => void;
}

export default function FilterButton({ active, hasActiveFilters, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Filtros"
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      {hasActiveFilters && !active && (
        <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white dark:ring-zinc-950" />
      )}
    </button>
  );
}
