export default function LoadingSplash() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F1F4E6] px-6 text-zinc-900">
      <img
        src={`${import.meta.env.BASE_URL}icon-source.png`}
        alt=""
        aria-hidden
        className="mb-4 h-20 w-20"
      />
      <p className="mb-1 text-base font-semibold text-zinc-700">App de Alimentação</p>
      <p className="text-xs text-zinc-500">Conectando…</p>
    </div>
  );
}
