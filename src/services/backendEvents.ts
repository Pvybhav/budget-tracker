const eventTarget = new EventTarget();

export function addBackendRefreshListener(listener: (event: Event) => void) {
  eventTarget.addEventListener('backend-refresh', listener);
}

export function removeBackendRefreshListener(listener: (event: Event) => void) {
  eventTarget.removeEventListener('backend-refresh', listener);
}

export function dispatchBackendRefresh() {
  eventTarget.dispatchEvent(new Event('backend-refresh'));
}
