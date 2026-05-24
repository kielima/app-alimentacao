import { useCallback, useRef } from 'react';

export interface UseLongPressOptions {
  /** Duração em ms até disparar o long-press. */
  delay?: number;
  /** Quanto o ponteiro pode mover (px) antes de cancelar. */
  moveTolerance?: number;
}

/**
 * Detecta long-press (toque/clique segurado) e suprime o clique subsequente
 * quando o gesto é acionado, para coexistir com `<Link>`/`<button>`.
 */
export function useLongPress(
  onLongPress: () => void,
  { delay = 500, moveTolerance = 8 }: UseLongPressOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      triggeredRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(15);
          } catch {
            // ignore vibration errors
          }
        }
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startPosRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > moveTolerance) clear();
    },
    [moveTolerance, clear],
  );

  const onPointerUp = clear;
  const onPointerCancel = clear;
  const onPointerLeave = clear;

  const onClick = useCallback((e: React.MouseEvent) => {
    if (triggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      triggeredRef.current = false;
    }
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Evita o menu nativo aparecer sobre o nosso bottom sheet em mobile.
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClick,
    onContextMenu,
  };
}
