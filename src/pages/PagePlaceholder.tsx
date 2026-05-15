interface Props {
  icon: string;
  title: string;
  description: string;
}

export default function PagePlaceholder({ icon, title, description }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 text-6xl" aria-hidden>
        {icon}
      </div>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}
