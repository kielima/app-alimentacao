import { useLocation, useNavigate } from 'react-router-dom';

function fallbackPath(pathname: string): string {
  if (pathname.startsWith('/ingredientes')) return '/ingredientes';
  if (pathname.startsWith('/receitas')) return '/receitas';
  if (pathname.startsWith('/refeicoes')) return '/refeicoes';
  return '/';
}

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key === 'default') {
      navigate(fallbackPath(location.pathname), { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-zinc-200/60 px-3 text-base text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
      aria-label="Voltar"
    >
      ←
    </button>
  );
}
