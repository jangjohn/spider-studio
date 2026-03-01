import { useState, useEffect, useRef } from 'react';
import { countSelectorMatches } from '../../lib/previewWindow';

type ValidatorState = 'idle' | 'loading' | 'valid' | 'invalid';

interface SelectorValidatorProps {
  selector: string;
  previewUrl: string;
}

export function SelectorValidator({ selector, previewUrl }: SelectorValidatorProps) {
  const [state, setState] = useState<ValidatorState>('idle');
  const [count, setCount] = useState<number | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const trimmed = selector.trim();
    if (!trimmed || !previewUrl) {
      setState('idle');
      setCount(null);
      return;
    }

    setState('loading');
    abortRef.current = false;

    const timeoutId = setTimeout(async () => {
      try {
        const n = await countSelectorMatches(previewUrl, trimmed);
        if (abortRef.current) return;
        setCount(n);
        setState(n > 0 ? 'valid' : 'invalid');
      } catch {
        if (abortRef.current) return;
        setCount(0);
        setState('invalid');
      }
    }, 800);

    return () => {
      abortRef.current = true;
      clearTimeout(timeoutId);
    };
  }, [selector, previewUrl]);

  if (state === 'idle') return null;

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs">
      {state === 'loading' && (
        <div className="w-2.5 h-2.5 border border-[var(--color-secondary)] border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {state === 'valid' && (
        <>
          <div className="w-2 h-2 rounded-full bg-[var(--color-success)] shrink-0" />
          <span className="text-[var(--color-success)] font-mono">{count} found</span>
        </>
      )}
      {state === 'invalid' && (
        <>
          <div className="w-2 h-2 rounded-full bg-[var(--color-error)] shrink-0" />
          <span className="text-[var(--color-error)] font-mono">{count ?? 0} found</span>
        </>
      )}
    </div>
  );
}
