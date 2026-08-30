import { API_BASE_URL } from "./config";
import { finishNetworkRequest, showNetworkToast, startNetworkRequest } from "./network.service";

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const body = isJson ? await response.json().catch(() => null) : null;
    const message = body?.error || body?.message || response.statusText || "API error";
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return isJson ? ((await response.json()) as T) : ((await response.text()) as unknown as T);
}

async function apiRequest<T>(fetcher: () => Promise<T>) {
  startNetworkRequest();
  try {
    return await fetcher();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    showNetworkToast(message, "error");
    throw error;
  } finally {
    finishNetworkRequest();
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
    });
    return handleResponse<T>(response);
  });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return handleResponse<T>(response);
  });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return handleResponse<T>(response);
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse<T>(response);
  });
}
