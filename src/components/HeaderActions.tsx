import ThemeToggle from './ThemeToggle';

export default function HeaderActions({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <button
        type="button"
        onClick={() => {
          if (confirm('Sair? Você precisará inserir o PIN novamente na próxima abertura.')) {
            onSignOut();
          }
        }}
        className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        aria-label="Sair"
        title="Sair"
      >
        🔒
      </button>
    </div>
  );
}
