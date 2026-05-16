import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HEADER_SLOT_ID = 'page-header-actions';

export default function HeaderSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setEl(document.getElementById(HEADER_SLOT_ID));
  }, []);
  if (!el) return null;
  return createPortal(children, el);
}
