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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden
      >
        <rect x="2" y="5" width="1.5" height="14" />
        <rect x="4.5" y="5" width="1" height="14" />
        <rect x="6.5" y="5" width="2" height="14" />
        <rect x="9.5" y="5" width="0.75" height="14" />
        <rect x="11" y="5" width="1.5" height="14" />
        <rect x="13.25" y="5" width="0.75" height="14" />
        <rect x="14.75" y="5" width="2" height="14" />
        <rect x="17.5" y="5" width="1" height="14" />
        <rect x="19.5" y="5" width="2.5" height="14" />
      </svg>
    </button>
  );
}
