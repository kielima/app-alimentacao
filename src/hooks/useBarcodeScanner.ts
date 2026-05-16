import { useCallback, useEffect, useRef, useState } from 'react';

type ScanState = 'idle' | 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error';

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function hasNativeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export interface UseBarcodeScannerOptions {
  onDetected: (code: string, format?: string) => void;
  enabled: boolean;
}

export function useBarcodeScanner({ onDetected, enabled }: UseBarcodeScannerOptions) {
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // ignore
      }
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      setState('idle');
      setError(null);
      return;
    }

    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported');
        setError('Câmera não suportada neste navegador.');
        return;
      }
      setState('requesting');
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        if (cancelled) return;
        setState('scanning');

        if (hasNativeDetector()) {
          await runNativeLoop(video);
        } else {
          await runZxingLoop(video);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
          setState('denied');
          setError('Permissão de câmera negada.');
        } else if (err instanceof DOMException && err.name === 'NotFoundError') {
          setState('unsupported');
          setError('Nenhuma câmera encontrada.');
        } else {
          setState('error');
          setError(message);
        }
        stop();
      }
    }

    async function runNativeLoop(video: HTMLVideoElement) {
      const Ctor = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorConstructor })
        .BarcodeDetector;
      let formats = SUPPORTED_FORMATS;
      try {
        if (Ctor.getSupportedFormats) {
          const supported = await Ctor.getSupportedFormats();
          formats = SUPPORTED_FORMATS.filter((f) => supported.includes(f));
          if (!formats.length) formats = SUPPORTED_FORMATS;
        }
      } catch {
        // usa default
      }
      const detector = new Ctor({ formats });

      const tick = async () => {
        if (cancelled) return;
        if (video.readyState >= 2) {
          try {
            const results = await detector.detect(video);
            if (results.length) {
              const first = results[0];
              if (first?.rawValue) {
                onDetectedRef.current(first.rawValue, first.format);
                return;
              }
            }
          } catch {
            // frame ruim, segue
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    async function runZxingLoop(video: HTMLVideoElement) {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader();
      const stream = streamRef.current;
      if (!stream) return;
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (cancelled || !result) return;
        const text = result.getText();
        if (text) {
          onDetectedRef.current(text, String(result.getBarcodeFormat?.() ?? ''));
        }
      });
      zxingControlsRef.current = controls;
    }

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop]);

  return { videoRef, state, error, stop };
}

export function isBarcodeScanSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return true;
}
