import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteOffContribution,
  upsertOffContribution,
  useOffContributions,
} from '../data/offContributions';

function buildOffNewProductUrl(barcode: string, name: string, brands?: string): string {
  const params = new URLSearchParams({
    type: 'edit',
    code: barcode,
  });
  if (name) params.set('product_name', name);
  if (brands) params.set('brands', brands);
  return `https://world.openfoodfacts.org/cgi/product.pl?${params.toString()}`;
}

export default function OffContribuicoes() {
  const drafts = useOffContributions();

  const sorted = useMemo(
    () =>
      [...drafts].sort((a, b) => {
        if (!!a.submitted_at !== !!b.submitted_at) return a.submitted_at ? 1 : -1;
        return b.created_at.localeCompare(a.created_at);
      }),
    [drafts],
  );

  const pendingCount = sorted.filter((d) => !d.submitted_at).length;

  return (
    <div className="mx-auto max-w-md px-4 pt-3 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/ingredientes"
          className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          ←
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Contribuições pro Open Food Facts</h1>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Sem rascunhos. Eles aparecem aqui quando você cadastra um produto novo a partir de um
          código de barras que não existe no Open Food Facts.
        </p>
      ) : (
        <>
          {pendingCount > 0 && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {pendingCount} rascunho{pendingCount > 1 ? 's' : ''} pendente
              {pendingCount > 1 ? 's' : ''} de envio. Cada botão abre o formulário do Open Food
              Facts já preenchido com os dados pra você confirmar e enviar.
            </p>
          )}
          <ul className="space-y-2">
            {sorted.map((d) => (
              <li
                key={d.id}
                className={`rounded-xl border p-3 ${
                  d.submitted_at
                    ? 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{d.barcode}</p>
                <p className="text-sm font-medium">{d.product_name}</p>
                {d.brands && <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.brands}</p>}
                {d.submitted_at ? (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    Marcado como enviado em {new Date(d.submitted_at).toLocaleDateString('pt-BR')}.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={buildOffNewProductUrl(d.barcode, d.product_name, d.brands)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                    >
                      Abrir no Open Food Facts ↗
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        upsertOffContribution({ ...d, submitted_at: new Date().toISOString() })
                      }
                      className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Marcar enviado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Descartar este rascunho?')) deleteOffContribution(d.id);
                      }}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
            Os rascunhos ficam aqui localmente. Abrir o link do Open Food Facts leva ao formulário
            oficial deles (precisa de uma conta OFF) com o código de barras já preenchido. Ao
            enviar lá, marque como enviado aqui pra não perder o controle.
          </p>
        </>
      )}
    </div>
  );
}
