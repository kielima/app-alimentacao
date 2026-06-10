import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useOffContributions } from '../data/offContributions';
import Icon from './Icon';

type Tab = { to: string; label: string };

const defaultTabs: Tab[] = [
  { to: '/plano', label: 'Plano Alimentar' },
  { to: '/refeicoes', label: 'Lista de Refeições' },
  { to: '/receitas', label: 'Livro de Receitas' },
  { to: '/ingredientes', label: 'Lista de Ingredientes' },
  { to: '/dispensa', label: 'Lista da Dispensa' },
  { to: '/compras', label: 'Lista de Compras' },
  { to: '/mercados', label: 'Lista de Mercados' },
  { to: '/perfil', label: 'Dados pessoais' },
];

const ORDER_STORAGE_KEY = 'app-alimentacao:nav-order';

function loadStoredOrder(): Tab[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return defaultTabs;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultTabs;
    const remaining = new Map(defaultTabs.map((t) => [t.to, t]));
    const ordered: Tab[] = [];
    for (const to of parsed) {
      if (typeof to !== 'string') continue;
      const t = remaining.get(to);
      if (t) {
        ordered.push(t);
        remaining.delete(to);
      }
    }
    for (const t of remaining.values()) ordered.push(t);
    return ordered;
  } catch {
    return defaultTabs;
  }
}

export default function NavMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const offDrafts = useOffContributions();
  const pendingOff = offDrafts.filter((d) => !d.submitted_at).length;
  const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const themeLabel = theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema';
  const themeIcon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';

  const [tabs, setTabs] = useState<Tab[]>(() => loadStoredOrder());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [itemHeight, setItemHeight] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(tabs.map((t) => t.to)));
    } catch {
      // ignore storage errors (quota, private mode)
    }
  }, [tabs]);

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
    if (confirm('Sair da conta Google?')) {
      onSignOut();
      setOpen(false);
    }
  }

  function startDrag(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const li = itemRefs.current[index];
    if (!li) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    dragStartYRef.current = e.clientY;
    setItemHeight(li.getBoundingClientRect().height);
    setDragIndex(index);
    setHoverIndex(index);
    setDragOffset(0);
  }

  function moveDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (dragIndex === null || itemHeight === 0) return;
    const dy = e.clientY - dragStartYRef.current;
    setDragOffset(dy);
    const steps = Math.round(dy / itemHeight);
    const next = Math.max(0, Math.min(tabs.length - 1, dragIndex + steps));
    if (next !== hoverIndex) setHoverIndex(next);
  }

  function endDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragPointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (dragIndex !== null && hoverIndex !== null && hoverIndex !== dragIndex) {
      setTabs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(hoverIndex, 0, moved);
        return next;
      });
    }
    dragPointerIdRef.current = null;
    setDragIndex(null);
    setHoverIndex(null);
    setDragOffset(0);
  }

  function computeShift(index: number): number {
    if (dragIndex === null || hoverIndex === null) return 0;
    if (index === dragIndex) return dragOffset;
    if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) return -itemHeight;
    if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) return itemHeight;
    return 0;
  }

  const isDragging = dragIndex !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 px-3 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        aria-label="Abrir menu de navegação"
        aria-expanded={open}
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div
        className={`fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[80] flex w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-zinc-900 ${
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
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {tabs.map((tab, index) => {
              const shift = computeShift(index);
              const dragging = dragIndex === index;
              return (
                <li
                  key={tab.to}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className="relative"
                  style={{
                    transform: shift ? `translateY(${shift}px)` : undefined,
                    transition: dragging ? 'none' : 'transform 180ms ease',
                    zIndex: dragging ? 10 : undefined,
                  }}
                >
                  <div
                    className={`flex items-center gap-1 rounded-2xl ${
                      dragging ? 'bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700' : ''
                    }`}
                  >
                    <NavLink
                      to={tab.to}
                      onClick={(e) => {
                        if (isDragging) {
                          e.preventDefault();
                          return;
                        }
                        setOpen(false);
                      }}
                      className={({ isActive }) =>
                        `flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
                          isActive
                            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50'
                        }`
                      }
                    >
                      <span>{tab.label}</span>
                    </NavLink>
                    <button
                      type="button"
                      aria-label={`Reordenar ${tab.label}`}
                      onPointerDown={(e) => startDrag(e, index)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <circle cx="9" cy="6" r="1.6" />
                        <circle cx="15" cy="6" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" />
                        <circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="18" r="1.6" />
                        <circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800 space-y-1">
          {offDrafts.length > 0 && (
            <NavLink
              to="/contribuicoes-off"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            >
              <Icon name="upload" className="h-5 w-5" />
              <span className="flex-1">Contribuições OFF</span>
              {pendingOff > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {pendingOff}
                </span>
              )}
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            aria-label={`Tema: ${themeLabel}. Clique para alternar.`}
          >
            <Icon name={themeIcon} className="h-5 w-5" />
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
