export type ToastType = "success" | "error" | "info";

export interface ToastPayload {
  id: number;
  type: ToastType;
  message: string;
}

const loadingListeners = new Set<(activeRequests: number, message: string) => void>();
const toastListeners = new Set<(toast: ToastPayload) => void>();

const activeRequests = new Map<number, string>();
let nextRequestId = 1;
let nextToastId = 1;
const recentErrorToasts = new Map<string, number>();

function notifyLoading() {
  const message = [...activeRequests.values()].at(-1) ?? "Updating your financial data…";
  loadingListeners.forEach((listener) => listener(activeRequests.size, message));
}

function notifyToast(toast: ToastPayload) {
  toastListeners.forEach((listener) => listener(toast));
}

export function onNetworkLoadingChange(
  listener: (activeRequests: number, message: string) => void,
) {
  loadingListeners.add(listener);
  listener(activeRequests.size, "Updating your financial data…");
  return () => {
    loadingListeners.delete(listener);
  };
}

export function onNetworkToast(listener: (toast: ToastPayload) => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function getNetworkRequestCount() {
  return activeRequests.size;
}

export function startNetworkRequest(message = "Updating your financial data…") {
  const requestId = nextRequestId++;
  activeRequests.set(requestId, message);
  notifyLoading();
  return requestId;
}

export function finishNetworkRequest(requestId: number) {
  activeRequests.delete(requestId);
  notifyLoading();
}

export function showNetworkToast(message: string, type: ToastType = "info") {
  if (type === "error") {
    const lastShownAt = recentErrorToasts.get(message) ?? 0;
    if (Date.now() - lastShownAt < 5000) {
      return;
    }
    recentErrorToasts.set(message, Date.now());
  }
  const toast: ToastPayload = {
    id: nextToastId++,
    type,
    message,
  };

  notifyToast(toast);
  return toast.id;
}
