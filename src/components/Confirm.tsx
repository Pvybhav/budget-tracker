import React from "react";
import { createRoot } from "react-dom/client";
import { X, AlertTriangle } from "lucide-react";

interface Options {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

export function showConfirm(message: string, opts: Options = {}) {
  return new Promise<boolean>((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = (val: boolean) => {
      resolve(val);
      setTimeout(() => {
        try {
          root.unmount();
        } catch {
          // Ignore errors during unmounting, as the component may have already been unmounted
        }
        container.remove();
      }, 100);
    };

    function Confirm() {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => handleClose(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <div className="rounded-md bg-amber-100 dark:bg-amber-500/10 p-2 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {opts.title ?? "Are you sure?"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{message}</div>
              </div>
              <button
                onClick={() => handleClose(false)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-end gap-3">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
              >
                {opts.cancelText ?? "Cancel"}
              </button>
              <button
                onClick={() => handleClose(true)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                {opts.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    root.render(React.createElement(Confirm));
  });
}

export default showConfirm;

export function showAlert(message: string, opts: { title?: string; okText?: string } = {}) {
  return new Promise<void>((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = () => {
      resolve();
      setTimeout(() => {
        try {
          root.unmount();
        } catch {
          // Ignore errors during unmounting, as the component may have already been unmounted
        }
        container.remove();
      }, 100);
    };

    function Alert() {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-start gap-3">
              <div className="rounded-md bg-emerald-400/10 p-2 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-100">{opts.title ?? "Notice"}</div>
                <div className="text-sm text-slate-400 mt-1">{message}</div>
              </div>
            </div>

            <div className="p-4 flex items-center justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {opts.okText ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    root.render(React.createElement(Alert));
  });
}
