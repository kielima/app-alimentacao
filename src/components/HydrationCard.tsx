import Icon from './Icon';
import {
  useAgua,
  useMeta,
  aguaDoDia,
  registrarAgua,
  definirAguaDoDia,
  ML_COPO,
  ML_GARRAFA,
} from '../data/hydration';

// Card de hidratação sincronizado com o app de Ritual. Registrar um copo aqui
// soma no MESMO dado que o ritual usa (users/{uid}/dados/aguaIngerida), então a
// barra de água do ritual sobe na hora — e o contrário também. Sempre referente
// a HOJE, independentemente do dia selecionado no plano.
export default function HydrationCard() {
  const map = useAgua();
  const meta = useMeta();
  const total = aguaDoDia(map);
  const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;
  const fmt = (ml: number) => (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  return (
    <div className="mt-3 rounded-xl bg-sky-50 px-4 py-3 dark:bg-sky-950/30">
      <div className="mb-2 flex items-center justify-between">
        <p className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300">
          <Icon name="cup-soda" className="h-3.5 w-3.5" /> Água — hoje
        </p>
        <span className="text-xs text-sky-700/80 dark:text-sky-300/80">
          {fmt(total)} / {fmt(meta)} L
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900/50">
          <div
            className="h-2 rounded-full bg-sky-500 transition-all duration-300 dark:bg-sky-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400">{pct}%</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => registrarAgua(ML_COPO)}
          className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          + {ML_COPO} ml
        </button>
        <button
          type="button"
          onClick={() => registrarAgua(ML_GARRAFA)}
          className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          + {ML_GARRAFA} ml
        </button>
        <button
          type="button"
          onClick={() => registrarAgua(-ML_COPO)}
          disabled={total === 0}
          aria-label="Remover um copo"
          className="inline-flex items-center justify-center rounded-full border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-40 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-900/40"
        >
          − {ML_COPO} ml
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={() => definirAguaDoDia(0)}
            className="ml-auto text-xs text-sky-600/70 hover:underline dark:text-sky-400/70"
          >
            Zerar
          </button>
        )}
      </div>
    </div>
  );
}
