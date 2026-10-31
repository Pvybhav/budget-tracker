import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "budget-tracker-mobile-token";
const USER_KEY = "budget-tracker-mobile-user";
const OUTBOX_PREFIX = "budget-tracker-mobile-outbox:";

export type PendingMutation = {
  id: string;
  username: string;
  resource: string;
  operation: "create" | "update" | "delete";
  recordId: string;
  payload?: Record<string, unknown>;
  collection: string;
  optimisticRecord?: unknown;
  createdAt: number;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const queueLocks = new Map<string, Promise<void>>();
const activeCreates = new Set<string>();

async function updateOutbox<T>(
  username: string,
  update: (pending: PendingMutation[]) => { pending: PendingMutation[]; result: T },
) {
  const key = `${OUTBOX_PREFIX}${username}`;
  const previous = queueLocks.get(key) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  queueLocks.set(key, current);
  await previous;
  try {
    const stored = await AsyncStorage.getItem(key);
    const pending = stored ? JSON.parse(stored) as PendingMutation[] : [];
    const result = update(pending);
    await AsyncStorage.setItem(key, JSON.stringify(result.pending));
    return result.result;
  } finally {
    release();
    if (queueLocks.get(key) === current) queueLocks.delete(key);
  }
}

export type SessionUser = { username: string; fullName: string; role: string };

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await parseResponse<{ user: SessionUser; token: string }>(response);
  await AsyncStorage.setItem(TOKEN_KEY, body.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(body.user));
  return body.user;
}

export async function signup(username: string, password: string, fullName: string, email: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, fullName, email }),
  });
  const body = await parseResponse<{ user: SessionUser; token: string }>(response);
  await AsyncStorage.setItem(TOKEN_KEY, body.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(body.user));
  return body.user;
}

export async function logout() {
  const token = await getToken();
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => undefined);
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getCachedUser(): Promise<SessionUser | null> {
  const stored = await AsyncStorage.getItem(USER_KEY);
  if (!stored) return null;
  const parsed: unknown = JSON.parse(stored);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as SessionUser).username !== "string" ||
    typeof (parsed as SessionUser).fullName !== "string" ||
    typeof (parsed as SessionUser).role !== "string"
  ) {
    throw new Error("The saved mobile session is invalid.");
  }
  return parsed as SessionUser;
}

export async function getSession() {
  const session = await apiRequest<{ user: SessionUser }>("/auth/session");
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user));
  return session;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  let parsed: unknown = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String(parsed.error)
        : response.statusText || "Request failed";
    throw new ApiError(message, response.status);
  }
  return parsed as T;
}

export async function fetchMobileSnapshot() {
  const resources = [
    "cards", "categories", "expenses", "payments", "transfers", "bills", "income",
    "loans", "insurance", "budget-rules", "savings-goals", "investments", "reward-points",
    "net-worth-snapshots", "household",
  ];
  const entries = await Promise.all(resources.map(async (resource) => (
    [resource, await apiRequest<unknown>(`/${resource}`)] as const
  )));
  return Object.fromEntries(entries) as Record<string, unknown>;
}

export async function getPendingMutations(username: string) {
  const key = `${OUTBOX_PREFIX}${username}`;
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return [];
  const pending: unknown = JSON.parse(stored);
  if (!Array.isArray(pending)) throw new Error("The offline changes queue is invalid.");
  const valid = pending.every((item) =>
    item &&
    typeof item === "object" &&
    (item as PendingMutation).username === username &&
    typeof (item as PendingMutation).id === "string" &&
    typeof (item as PendingMutation).resource === "string" &&
    ["create", "update", "delete"].includes((item as PendingMutation).operation) &&
    typeof (item as PendingMutation).recordId === "string" &&
    typeof (item as PendingMutation).collection === "string");
  if (!valid) throw new Error("The offline changes queue contains invalid or mismatched account data.");
  return pending as PendingMutation[];
}

export async function enqueueMutation(mutation: PendingMutation) {
  return updateOutbox(mutation.username, (pending) => {
    const activeCreateKey = `${mutation.username}:${mutation.resource}:${mutation.recordId}`;
    const localCreateIndex = pending.findIndex((item) =>
      item.resource === mutation.resource &&
      item.operation === "create" &&
      item.recordId === mutation.recordId);

    if (mutation.operation === "update") {
      if (localCreateIndex >= 0 && !activeCreates.has(activeCreateKey)) {
        pending[localCreateIndex] = {
          ...pending[localCreateIndex],
          payload: mutation.payload,
          optimisticRecord: mutation.optimisticRecord,
        };
        return { pending, result: pending };
      }
      const updateIndex = pending.findIndex((item) =>
        item.resource === mutation.resource &&
        item.operation === "update" &&
        item.recordId === mutation.recordId);
      if (updateIndex >= 0) {
        pending[updateIndex] = mutation;
        return { pending, result: pending };
      }
    }

    if (mutation.operation === "delete") {
      if (localCreateIndex >= 0 && !activeCreates.has(activeCreateKey)) {
        pending.splice(localCreateIndex, 1);
        const remaining = pending.filter((item) => !(item.resource === mutation.resource && item.recordId === mutation.recordId));
        return {
          pending: remaining,
          result: remaining,
        };
      }
      if (localCreateIndex >= 0) {
        const remaining = pending.filter((item) => !(
          item.resource === mutation.resource &&
          item.recordId === mutation.recordId &&
          item.operation === "update"
        ));
        remaining.push(mutation);
        return { pending: remaining, result: remaining };
      }
      const remaining = pending.filter((item) => !(item.resource === mutation.resource && item.recordId === mutation.recordId));
      remaining.push(mutation);
      return {
        pending: remaining,
        result: remaining,
      };
    }

    pending.push(mutation);
    return { pending, result: pending };
  });
}

export async function syncPendingMutations(
  username: string,
  onCreated: (mutation: PendingMutation, serverId: string) => void,
) {
  let synced = 0;
  while (true) {
    const pending = await getPendingMutations(username);
    const mutation = pending[0];
    if (!mutation) return { synced, remaining: 0 };

    let activeCreateKey: string | null = null;
    try {
      let serverId: string | null = null;
      if (mutation.operation === "create") {
        activeCreateKey = `${username}:${mutation.resource}:${mutation.recordId}`;
        activeCreates.add(activeCreateKey);
        const saved = await createResource<unknown>(mutation.resource, mutation.payload ?? {});
        if (saved && typeof saved === "object") {
          const record = saved as Record<string, unknown>;
          const value = record.id ?? record._id;
          if (typeof value === "string" || typeof value === "number") serverId = String(value);
        }
        if (!serverId) throw new Error(`The server did not return an ID for the created ${mutation.resource} record.`);
      } else if (mutation.operation === "update") {
        await updateResource(mutation.resource, mutation.recordId, mutation.payload ?? {});
      } else {
        await deleteResource(mutation.resource, mutation.recordId);
      }

      await updateOutbox(username, (current) => {
        const index = current.findIndex((item) => item.id === mutation.id);
        if (index < 0) return { pending: current, result: undefined };
        const latest = current[index];
        const changedDuringRequest = mutation.operation === "create" &&
          JSON.stringify(latest.payload) !== JSON.stringify(mutation.payload);
        if (changedDuringRequest && serverId) {
          current[index] = {
            ...latest,
            operation: "update",
            recordId: serverId,
          };
          return { pending: current, result: undefined };
        }
        current.splice(index, 1);
        if (serverId) {
          const resolvedServerId = serverId;
          current.forEach((item) => {
            if (item.resource === mutation.resource && item.recordId === mutation.recordId) item.recordId = resolvedServerId;
          });
        }
        return { pending: current, result: undefined };
      });
      if (activeCreateKey) activeCreates.delete(activeCreateKey);
      if (mutation.operation === "create" && serverId) onCreated(mutation, serverId);
      synced += 1;
    } catch (error) {
      if (activeCreateKey) activeCreates.delete(activeCreateKey);
      return { synced, remaining: pending.length, error };
    }
  }
}

export async function createResource<T>(resource: string, value: unknown) {
  return apiRequest<T>(`/${resource}`, { method: "POST", body: JSON.stringify(value) });
}

export async function updateResource<T>(resource: string, id: string, value: unknown) {
  return apiRequest<T>(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(value) });
}

export async function deleteResource(resource: string, id: string) {
  return apiRequest<{ success: boolean }>(`/${resource}/${id}`, { method: "DELETE" });
}

export async function fetchHousehold() {
  return apiRequest<{ role: "owner" | "member" | "none"; household: { members: { email: string; status: string }[] } | null }>("/household");
}

export async function inviteHouseholdMember(email: string) {
  return apiRequest<{ email: string; inviteToken: string }>("/household/invite", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function acceptHouseholdInvite(token: string) {
  return apiRequest<{ success: boolean }>("/household/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function removeHouseholdMember(email: string) {
  return apiRequest<{ success: boolean }>(`/household/members/${encodeURIComponent(email)}`, { method: "DELETE" });
}

export async function leaveHousehold() {
  return apiRequest<{ success: boolean }>("/household/leave", { method: "POST", body: JSON.stringify({}) });
}
