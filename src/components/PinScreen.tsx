import { useState } from 'react';

type Mode = 'create' | 'verify';

interface Props {
  mode: Mode;
  onSubmit: (pin: string) => Promise<boolean>;
}

const PIN_MIN = 4;
const PIN_MAX = 6;

export default function PinScreen({ mode, onSubmit }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = stage === 'enter' ? pin : confirm;
  const isCreate = mode === 'create';

  const handleDigit = (digit: string) => {
    setError(null);
    if (current.length >= PIN_MAX) return;
    if (stage === 'enter') setPin(pin + digit);
    else setConfirm(confirm + digit);
  };

  const handleBackspace = () => {
    setError(null);
    if (stage === 'enter') setPin(pin.slice(0, -1));
    else setConfirm(confirm.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (current.length < PIN_MIN) {
      setError(`Use no mínimo ${PIN_MIN} dígitos`);
      return;
    }

    if (isCreate && stage === 'enter') {
      setStage('confirm');
      return;
    }

    if (isCreate && stage === 'confirm') {
      if (pin !== confirm) {
        setError('Os PINs não coincidem');
        setConfirm('');
        setStage('enter');
        setPin('');
        return;
      }
    }

    setSubmitting(true);
    const ok = await onSubmit(pin);
    setSubmitting(false);
    if (!ok) {
      setError('PIN incorreto');
      setPin('');
    }
  };

  const title = isCreate
    ? stage === 'enter'
      ? 'Crie um PIN'
      : 'Confirme o PIN'
    : 'Insira seu PIN';

  const subtitle = isCreate && stage === 'enter' ? `${PIN_MIN} a ${PIN_MAX} dígitos` : null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mb-2 text-5xl" aria-hidden>
          🍳
        </div>
        <h1 className="text-xl font-semibold">App de Alimentação</h1>
      </div>

      <p className="mb-2 text-base font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      {subtitle && <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}

      <div className="mb-3 flex gap-2" role="status" aria-label={`${current.length} de ${PIN_MAX} dígitos`}>
        {Array.from({ length: PIN_MAX }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border ${
              i < current.length
                ? 'border-brand-500 bg-brand-500'
                : 'border-zinc-300 bg-transparent dark:border-zinc-700'
            }`}
          />
        ))}
      </div>

      <div className="h-5 text-sm text-red-500" aria-live="polite">
        {error}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PinButton key={d} onClick={() => handleDigit(d)} disabled={submitting}>
            {d}
          </PinButton>
        ))}
        <PinButton onClick={handleSubmit} disabled={submitting || current.length < PIN_MIN}>
          OK
        </PinButton>
        <PinButton onClick={() => handleDigit('0')} disabled={submitting}>
          0
        </PinButton>
        <PinButton onClick={handleBackspace} disabled={submitting || current.length === 0}>
          ⌫
        </PinButton>
      </div>
    </div>
  );
}

function PinButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 rounded-full bg-zinc-100 text-2xl font-medium text-zinc-900 transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-30 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
    >
      {children}
    </button>
  );
}
