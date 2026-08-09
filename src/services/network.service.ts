export type ToastType = 'success' | 'error' | 'info';

export interface ToastPayload {
  id: number;
  type: ToastType;
  message: string;
}

const loadingListeners = new Set<(activeRequests: number) => void>();
const toastListeners = new Set<(toast: ToastPayload) => void>();

let activeRequestCount = 0;
let nextToastId = 1;

function notifyLoading() {
  loadingListeners.forEach((listener) => listener(activeRequestCount));
}

function notifyToast(toast: ToastPayload) {
  toastListeners.forEach((listener) => listener(toast));
}

export function onNetworkLoadingChange(
  listener: (activeRequests: number) => void,
) {
  loadingListeners.add(listener);
  listener(activeRequestCount);
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
  return activeRequestCount;
}

export function startNetworkRequest() {
  activeRequestCount += 1;
  notifyLoading();
}

export function finishNetworkRequest() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  notifyLoading();
}

export function showNetworkToast(
  message: string,
  type: ToastType = 'info',
) {
  const toast: ToastPayload = {
    id: nextToastId++,
    type,
    message,
  };

  notifyToast(toast);
  return toast.id;
}
