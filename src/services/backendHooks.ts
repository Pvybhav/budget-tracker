import { useCallback, useEffect, useState } from 'react';
import {
  addBackendRefreshListener,
  removeBackendRefreshListener,
} from './backendEvents';

export function useBackendResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const [data, setData] = useState<T | undefined>();

  const memoizedFetcher = useCallback(fetcher, deps);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result = await memoizedFetcher();
        if (!active) return;
        setData(result);
      } catch (error) {
        console.error('Backend fetch failed', error);
        if (!active) return;
        setData(undefined);
      }
    };

    void load();

    const refreshListener = () => {
      void load();
    };

    addBackendRefreshListener(refreshListener);
    return () => {
      active = false;
      removeBackendRefreshListener(refreshListener);
    };
  }, [memoizedFetcher]);

  return data;
}
