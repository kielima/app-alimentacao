import { useTheme } from '../hooks/useTheme';
import Icon from './Icon';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const label = theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema';
  const icon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      aria-label={`Tema: ${label}. Clique para alternar.`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
