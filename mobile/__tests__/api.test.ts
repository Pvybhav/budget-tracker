import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ApiError,
  apiRequest,
  enqueueMutation,
  getCachedUser,
  fetchMobileSnapshot,
  getSession,
  getPendingMutations,
  login,
  logout,
  signup,
  syncPendingMutations,
  type PendingMutation,
} from "../api";

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? "Created" : status === 400 ? "Bad Request" : "OK",
    text: async () => JSON.stringify(body),
  } as Response;
}

function mutation(overrides: Partial<PendingMutation> = {}): PendingMutation {
  return {
    id: `mutation-${Math.random()}`,
    username: "alice",
    resource: "expenses",
    operation: "create",
    recordId: "local-expense-1",
    payload: { details: "Coffee", amount: 5 },
    collection: "expenses",
    optimisticRecord: { id: "local-expense-1", title: "Coffee", amount: 5 },
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

describe("session API", () => {
  const user = { username: "alice", fullName: "Alice", role: "user" };

  it("persists the authenticated user and token after login", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { user, token: "session-token" }));

    await expect(login("alice", "password")).resolves.toEqual(user);
    await expect(AsyncStorage.getItem("budget-tracker-mobile-token")).resolves.toBe("session-token");
    await expect(getCachedUser()).resolves.toEqual(user);
  });

  it("persists account creation and refreshes the cached session", async () => {
    fetchMock
      .mockResolvedValueOnce(response(201, { user, token: "signup-token" }))
      .mockResolvedValueOnce(response(200, { user: { ...user, fullName: "Alice Updated" } }));

    await signup("alice", "password", "Alice", "alice@example.com");
    await expect(getSession()).resolves.toEqual({ user: { ...user, fullName: "Alice Updated" } });
    await expect(getCachedUser()).resolves.toEqual({ ...user, fullName: "Alice Updated" });
    expect(await AsyncStorage.getItem("budget-tracker-mobile-token")).toBe("signup-token");
  });

  it("clears sign-in data on logout but preserves queued offline changes", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { user, token: "session-token" }));
    await login("alice", "password");
    await enqueueMutation(mutation());
    fetchMock.mockResolvedValueOnce(response(204, null));

    await logout();

    expect(await AsyncStorage.getItem("budget-tracker-mobile-token")).toBeNull();
    await expect(getCachedUser()).resolves.toBeNull();
    await expect(getPendingMutations("alice")).resolves.toHaveLength(1);
  });

  it("rejects malformed saved account data and preserves HTTP status details", async () => {
    await AsyncStorage.setItem("budget-tracker-mobile-user", "{broken");
    await expect(getCachedUser()).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(response(401, { error: "Invalid token" }));

    await expect(apiRequest("/private")).rejects.toMatchObject({
      message: "Invalid token",
      status: 401,
    });
  });
});

describe("offline mutation queue", () => {
  it("isolates pending changes by account", async () => {
    await enqueueMutation(mutation());
    await enqueueMutation(mutation({
      id: "bob-create",
      username: "bob",
      recordId: "bob-expense",
    }));

    expect(await getPendingMutations("alice")).toHaveLength(1);
    expect(await getPendingMutations("bob")).toHaveLength(1);
  });

  it("coalesces edits to an unsynced create and cancels it on delete", async () => {
    await enqueueMutation(mutation());
    await enqueueMutation(mutation({
      id: "edit-before-sync",
      operation: "update",
      payload: { details: "Latte", amount: 7 },
      optimisticRecord: { id: "local-expense-1", title: "Latte", amount: 7 },
    }));

    const updated = await getPendingMutations("alice");
    expect(updated).toHaveLength(1);
    expect(updated[0].payload).toEqual({ details: "Latte", amount: 7 });

    await enqueueMutation(mutation({ id: "delete-before-sync", operation: "delete", payload: undefined }));
    expect(await getPendingMutations("alice")).toEqual([]);
  });

  it("serializes concurrent enqueues without losing mutations", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, index) =>
      enqueueMutation(mutation({ id: `mutation-${index}`, recordId: `local-${index}` })),
    ));

    expect(await getPendingMutations("alice")).toHaveLength(10);
  });

  it("creates locally queued records and calls the ID reconciliation hook", async () => {
    fetchMock.mockResolvedValueOnce(response(201, { _id: "server-expense-1" }));
    await enqueueMutation(mutation());
    const onCreated = jest.fn();

    await expect(syncPendingMutations("alice", onCreated)).resolves.toEqual({ synced: 1, remaining: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/expenses"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ recordId: "local-expense-1" }), "server-expense-1");
    expect(await getPendingMutations("alice")).toEqual([]);
  });

  it("resolves dependent updates to the server ID and keeps queue order", async () => {
    fetchMock
      .mockImplementationOnce(async () => {
        await enqueueMutation(mutation({
          id: "edit",
          operation: "update",
          payload: { details: "Coffee", amount: 8 },
          optimisticRecord: { id: "local-expense-1", title: "Coffee", amount: 8 },
        }));
        return response(201, { id: "server-expense-1" });
      })
      .mockResolvedValueOnce(response(200, { id: "server-expense-1", amount: 8 }));
    await enqueueMutation(mutation());

    const result = await syncPendingMutations("alice", jest.fn());
    expect(result).toEqual({ synced: 2, remaining: 0 });
    expect(fetchMock.mock.calls[1][0]).toContain("/expenses/server-expense-1");
  });

  it("retains a rejected mutation and reports its API error", async () => {
    fetchMock.mockResolvedValueOnce(response(400, { error: "Account is required" }));
    await enqueueMutation(mutation());

    const result = await syncPendingMutations("alice", jest.fn());
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
    expect(result.error).toBeInstanceOf(ApiError);
    await expect(getPendingMutations("alice")).resolves.toHaveLength(1);
  });

  it("rejects a partial snapshot instead of returning empty arrays as real data", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      return path.endsWith("/expenses")
        ? response(503, { error: "Temporarily unavailable" })
        : response(200, []);
    });

    await expect(fetchMobileSnapshot()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects corrupted or cross-account outbox entries", async () => {
    await AsyncStorage.setItem("budget-tracker-mobile-outbox:alice", JSON.stringify([
      mutation({ username: "bob" }),
    ]));
    await expect(getPendingMutations("alice")).rejects.toThrow("invalid or mismatched");
  });
});
