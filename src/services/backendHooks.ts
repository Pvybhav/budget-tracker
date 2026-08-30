import { useEffect, useState } from "react";
import { addBackendRefreshListener, removeBackendRefreshListener } from "./backendEvents";
export function useBackendResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const [data, setData] = useState<T | undefined>();
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await fetcher();
        if (!active) return;
        setData(result);
      } catch (error) {
        console.error("Backend fetch failed", error);
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
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}
