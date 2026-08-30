import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { onNetworkLoadingChange, onNetworkToast } from "../services/network.service";
import type { ToastPayload } from "../services/network.service";
import { X, Loader2 } from "lucide-react";

interface ToastState extends ToastPayload {
  visible: boolean;
}

export default function NetworkToastProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const offLoading = onNetworkLoadingChange(setLoadingCount);
    const offToast = onNetworkToast((toast) => {
      setToasts((current) => [...current, { ...toast, visible: true }]);
    });
    return () => {
      offLoading();
      offToast();
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) =>
          current.map((item) => (item.id === toast.id ? { ...item, visible: false } : item)),
        );
      }, 4000),
    );

    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [toasts]);

  const toastNodes = useMemo(
    () =>
      toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto max-w-sm w-full rounded-2xl border px-4 py-3 shadow-2xl transition-all duration-300 overflow-hidden ${
            toast.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          } ${
            toast.type === "success"
              ? "bg-emerald-500/95 border-emerald-300 text-slate-950"
              : toast.type === "error"
                ? "bg-rose-500/95 border-rose-300 text-slate-950"
                : "bg-slate-800/95 border-slate-600 text-slate-100"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-6">{toast.message}</p>
            <button
              type="button"
              className="text-slate-900/80 hover:text-slate-900"
              onClick={() => {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )),
    [toasts],
  );

  return (
    <>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-5 z-[100] flex flex-col items-center gap-3 px-4">
          {toastNodes}
        </div>,
        document.body,
      )}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-start justify-center px-4 pt-6">
          {loadingCount > 0 && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700/80 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
              <span className="text-sm text-slate-100">Network activity in progress...</span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
