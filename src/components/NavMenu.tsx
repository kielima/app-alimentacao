import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/plano', icon: '📅', label: 'Plano' },
  { to: '/refeicoes', icon: '📋', label: 'Minhas Refeições' },
  { to: '/receitas', icon: '🍳', label: 'Receitas' },
  { to: '/dispensa', icon: '🥫', label: 'Dispensa' },
  { to: '/compras', icon: '🛒', label: 'Compras' },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        aria-label="Menu de navegação"
        aria-expanded={open}
      >
        ☰
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-brand-500 dark:text-brand-400'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
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
      )}
    </div>
  );
}
