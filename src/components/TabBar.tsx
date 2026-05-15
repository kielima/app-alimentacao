import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/plano', icon: '📅', label: 'Plano' },
  { to: '/receitas', icon: '🍳', label: 'Receitas' },
  { to: '/dispensa', icon: '🥫', label: 'Dispensa' },
  { to: '/compras', icon: '🛒', label: 'Compras' },
];

export default function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-brand-500 dark:text-brand-400'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`
              }
            >
              <span className="text-2xl" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
