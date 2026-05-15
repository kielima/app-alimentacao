export default function LoadingSplash() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500 text-5xl shadow-lg dark:bg-brand-600">
        🍳
      </div>
      <p className="mb-1 text-base font-semibold text-zinc-700 dark:text-zinc-200">
        App de Alimentação
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Conectando…</p>
    </div>
  );
}
