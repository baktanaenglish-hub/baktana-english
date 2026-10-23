import { useEffect, useRef } from 'react';

/**
 * Runs `handler` when Enter is pressed anywhere (outside text fields). The
 * default is prevented so a focused button isn't also clicked.
 */
export function useEnterKey(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.repeat || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      ref.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
