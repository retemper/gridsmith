import type { ReadonlySignal } from '@gridsmith/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a core signal value from React.
 * Uses `useSyncExternalStore` for tear-free reads.
 */
export function useSignalValue<T>(sig: ReadonlySignal<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => sig.subscribe(() => onStoreChange()),
    [sig],
  );
  const getSnapshot = useCallback(() => sig.get(), [sig]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
