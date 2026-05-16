import { useEffect, useState } from 'react';
import { isBarcodeScanSupported } from '../hooks/useBarcodeScanner';

interface Props {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

export default function ScanButton({ onClick, className, ariaLabel = 'Escanear código de barras' }: Props) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isBarcodeScanSupported());
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={
        className ||
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
      }
    >
      <span aria-hidden>📷</span>
    </button>
  );
}
