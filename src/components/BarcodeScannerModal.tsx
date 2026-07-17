import { useCallback, useEffect, useState } from 'react';
import { useBarcodeScanner, DEFAULT_FORMATS } from '../hooks/useBarcodeScanner';
import { isValidEan, lookupBarcode, type OffLookupResult } from '../lib/openFoodFacts';
import { isNfceQrPayload, fetchNfce, type ExtractedNfce } from '../lib/nfce';
import ScannedProductCard from './ScannedProductCard';
import type { ScanAction } from './ScannedProductCard';
import NfceReceiptReview from './NfceReceiptReview';
import Icon from './Icon';
import type { DispensaItem } from '../hooks/useDispensa';

export interface BarcodeScanResult {
  barcode: string;
  lookup: OffLookupResult;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (result: BarcodeScanResult, action: ScanAction) => void;
  actions: ScanAction[];
  /** Além de código de barras de produto, também reconhece QR de nota fiscal (NFC-e). */
  enableNfce?: boolean;
  /** Itens com `status: 'comprar'`, usados para sugerir matches na revisão da nota fiscal. */
  comprarItems?: DispensaItem[];
}

type Stage =
  | { kind: 'scanning' }
  | { kind: 'looking-up'; barcode: string }
  | { kind: 'result'; barcode: string; lookup: OffLookupResult }
  | { kind: 'manual'; barcode: string }
  | { kind: 'nfce-loading' }
  | { kind: 'nfce-review'; data: ExtractedNfce }
  | { kind: 'nfce-error'; message: string };

const NFCE_FORMATS = [...DEFAULT_FORMATS, 'qr_code'];

export default function BarcodeScannerModal({
  open,
  onClose,
  onPick,
  actions,
  enableNfce = false,
  comprarItems = [],
}: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'scanning' });
  const [manualCode, setManualCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStage({ kind: 'scanning' });
      setManualCode('');
      setLookupError(null);
    }
  }, [open]);

  const handleDetected = useCallback(
    async (code: string) => {
      if (stage.kind !== 'scanning') return;
      if (typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }

      if (enableNfce && isNfceQrPayload(code)) {
        setStage({ kind: 'nfce-loading' });
        try {
          const data = await fetchNfce(code);
          setStage({ kind: 'nfce-review', data });
        } catch (err) {
          setStage({
            kind: 'nfce-error',
            message: err instanceof Error ? err.message : 'Falha ao ler a nota fiscal.',
          });
        }
        return;
      }

      setStage({ kind: 'looking-up', barcode: code });
      setLookupError(null);
      try {
        const lookup = await lookupBarcode(code);
        setStage({ kind: 'result', barcode: code, lookup });
      } catch (err) {
        setLookupError(err instanceof Error ? err.message : 'Falha ao consultar Open Food Facts.');
        setStage({ kind: 'result', barcode: code, lookup: { found: false } });
      }
    },
    [stage.kind, enableNfce],
  );

  const scannerActive = open && stage.kind === 'scanning';
  const { videoRef, state, error } = useBarcodeScanner({
    onDetected: handleDetected,
    enabled: scannerActive,
    formats: enableNfce ? NFCE_FORMATS : undefined,
  });

  if (!open) return null;

  const handleManualSubmit = async () => {
    const code = manualCode.trim();
    if (!isValidEan(code)) {
      setLookupError('Código inválido. Use EAN-8, EAN-13, UPC-A ou UPC-E.');
      return;
    }
    setStage({ kind: 'looking-up', barcode: code });
    setLookupError(null);
    try {
      const lookup = await lookupBarcode(code);
      setStage({ kind: 'result', barcode: code, lookup });
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Falha ao consultar Open Food Facts.');
      setStage({ kind: 'result', barcode: code, lookup: { found: false } });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-base font-semibold text-zinc-100">
          {enableNfce ? 'Escanear código de barras ou nota fiscal' : 'Escanear código de barras'}
        </h2>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md flex-1 overflow-y-auto px-4 pb-4">
        {stage.kind === 'scanning' && (
          <ScannerSurface
            videoRef={videoRef}
            state={state}
            error={error}
            hint={
              enableNfce
                ? 'Aponte para o código de barras do produto ou o QR da nota fiscal.'
                : undefined
            }
            onManual={() => setStage({ kind: 'manual', barcode: '' })}
          />
        )}

        {stage.kind === 'looking-up' && (
          <div className="mt-12 text-center text-sm text-zinc-300">
            <p className="mb-2 font-mono">{stage.barcode}</p>
            Buscando no Open Food Facts…
          </div>
        )}

        {stage.kind === 'result' && (
          <ScannedProductCard
            barcode={stage.barcode}
            lookup={stage.lookup}
            actions={actions}
            error={lookupError}
            onAction={(action) => onPick({ barcode: stage.barcode, lookup: stage.lookup }, action)}
            onScanAgain={() => setStage({ kind: 'scanning' })}
          />
        )}

        {stage.kind === 'nfce-loading' && (
          <div className="mt-12 text-center text-sm text-zinc-300">Lendo itens da nota fiscal…</div>
        )}

        {stage.kind === 'nfce-review' && (
          <NfceReceiptReview
            data={stage.data}
            comprarItems={comprarItems}
            onApply={onClose}
            onCancel={() => setStage({ kind: 'scanning' })}
          />
        )}

        {stage.kind === 'nfce-error' && (
          <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-zinc-900 p-4 text-center text-zinc-100">
            <p className="mb-3 text-sm text-red-400">{stage.message}</p>
            <button
              type="button"
              onClick={() => setStage({ kind: 'scanning' })}
              className="w-full rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
            >
              Escanear de novo
            </button>
          </div>
        )}

        {stage.kind === 'manual' && (
          <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-zinc-900 p-4 text-zinc-100">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Digitar código
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              placeholder="EAN-13 (13 dígitos)"
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-base text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
            {lookupError && <p className="mb-2 text-xs text-red-400">{lookupError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualCode}
                className="flex-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setStage({ kind: 'scanning' })}
                className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScannerSurface({
  videoRef,
  state,
  error,
  hint,
  onManual,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: ReturnType<typeof useBarcodeScanner>['state'];
  error: string | null;
  hint?: string;
  onManual: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black aspect-[3/4]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-1/3 w-4/5 rounded-xl border-2 border-brand-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {state !== 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center text-sm text-zinc-200">
            {state === 'requesting' && 'Pedindo permissão da câmera…'}
            {state === 'denied' && (
              <span>
                Permissão negada. Habilite o acesso à câmera nas configurações do navegador.
              </span>
            )}
            {state === 'unsupported' && (error || 'Câmera não disponível neste dispositivo.')}
            {state === 'error' && (error || 'Não foi possível iniciar a câmera.')}
            {state === 'idle' && '…'}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400">
        {hint || 'Aponte para o código de barras do produto.'}
      </p>
      <button
        type="button"
        onClick={onManual}
        className="mt-3 rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
      >
        Digitar código manualmente
      </button>
    </div>
  );
}
