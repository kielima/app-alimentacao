import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const tabs = [
  { to: '/plano', icon: '📅', label: 'Plano' },
  { to: '/refeicoes', icon: '📋', label: 'Refeições' },
  { to: '/receitas', icon: '🍳', label: 'Receitas' },
  { to: '/dispensa', icon: '🥫', label: 'Dispensa' },
  { to: '/compras', icon: '🛒', label: 'Compras' },
];

export default function NavMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const themeLabel = theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema';
  const themeIcon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  function handleSignOut() {
    if (confirm('Sair? Você precisará inserir o PIN novamente na próxima abertura.')) {
      onSignOut();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        aria-label="Abrir menu de navegação"
        aria-expanded={open}
      >
        ☰
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-zinc-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        aria-hidden={!open}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Fechar menu"
          >
            ☰
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50'
                    }`
                  }
                >
                  <span className="text-lg" aria-hidden>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800 space-y-1">
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            aria-label={`Tema: ${themeLabel}. Clique para alternar.`}
          >
            <span className="text-lg" aria-hidden>{themeIcon}</span>
            <span>Tema: {themeLabel}</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
