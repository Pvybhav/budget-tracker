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

function getRequestMessage(path: string, method: string) {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const resource = segments[segments.length - 1] ?? "data";
  const messages: Record<string, { singular: string; plural: string }> = {
    cards: { singular: "account", plural: "accounts" },
    expenses: { singular: "expense", plural: "expenses" },
    categories: { singular: "category", plural: "categories" },
    payments: { singular: "payment", plural: "payments" },
    transfers: { singular: "transfer", plural: "account transfers" },
    beneficiaries: { singular: "beneficiary", plural: "beneficiaries" },
    loans: { singular: "loan", plural: "loans" },
    bills: { singular: "bill", plural: "bills" },
    income: { singular: "income", plural: "income" },
    insurance: { singular: "insurance policy", plural: "insurance policies" },
    "budget-rules": { singular: "budget rule", plural: "budget rules" },
    "savings-goals": { singular: "savings goal", plural: "savings goals" },
    "net-worth-snapshots": { singular: "net-worth snapshot", plural: "net-worth history" },
  };
  const resourceName = Object.prototype.hasOwnProperty.call(messages, resource) || resource === "health"
    ? resource
    : segments[segments.length - 2] ?? resource;
  if (resourceName === "health") return "Checking your connection…";
  const fallback = resourceName.replaceAll("-", " ");
  const messageName = messages[resourceName] ?? { singular: fallback, plural: fallback };
  const action = method === "GET" ? "Loading" : method === "DELETE" ? "Deleting" : "Saving";
  const target = method === "GET" ? messageName.plural : messageName.singular;
  return `${action} your ${target}…`;
}

async function apiRequest<T>(fetcher: () => Promise<T>, path: string, method: string) {
  const requestId = startNetworkRequest(getRequestMessage(path, method));
  try {
    return await fetcher();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    showNetworkToast(message, "error");
    throw error;
  } finally {
    finishNetworkRequest(requestId);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
    });
    return handleResponse<T>(response);
  }, path, "GET");
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
  }, path, "POST");
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
  }, path, "PUT");
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse<T>(response);
  }, path, "DELETE");
}
