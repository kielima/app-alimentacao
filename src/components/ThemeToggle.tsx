import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const label = theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema';
  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60"
      aria-label={`Tema: ${label}. Clique para alternar.`}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
