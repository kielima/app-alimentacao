import { Link } from 'react-router-dom';

export default function Receitas() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 text-6xl" aria-hidden>
        🍳
      </div>
      <h2 className="mb-2 text-xl font-semibold">Receitas</h2>
      <p className="mb-6 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        Livro de receitas com dados nutricionais. Listagem e cadastro chegam na Fase 3.
      </p>
      <Link
        to="/ingredientes"
        className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        🥕 Explorar ingredientes
      </Link>
    </div>
  );
}
