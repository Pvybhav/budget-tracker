import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ApiError,
  apiRequest,
  acceptHouseholdInvite,
  enqueueMutation,
  createResource,
  deleteResource,
  getCachedUser,
  fetchMobileSnapshot,
  fetchHousehold,
  getSession,
  getPendingMutations,
  inviteHouseholdMember,
  login,
  leaveHousehold,
  logout,
  removeHouseholdMember,
  signup,
  syncPendingMutations,
  updateResource,
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

  it("handles empty, invalid, and non-JSON API responses with status fallbacks", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { user, token: "token" }));
    await login("alice", "password");

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server unavailable",
      text: async () => "not-json",
    } as Response);
    await expect(apiRequest("/failure")).rejects.toMatchObject({
      message: "Server unavailable",
      status: 500,
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "",
    } as Response);
    await expect(apiRequest("/failure")).rejects.toMatchObject({
      message: "Service Unavailable",
      status: 503,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: "",
      text: async () => "",
    } as Response);
    await expect(apiRequest("/empty")).resolves.toBeNull();
  });

  it("tolerates logout network failures and sends no authorization header without a token", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST", headers: undefined }),
    );
  });

  it("validates malformed outbox data and coalesces repeated server-side updates", async () => {
    await AsyncStorage.setItem("budget-tracker-mobile-outbox:alice", "{broken");
    await expect(getPendingMutations("alice")).rejects.toThrow();
    await AsyncStorage.setItem("budget-tracker-mobile-outbox:alice", JSON.stringify({ not: "an array" }));
    await expect(getPendingMutations("alice")).rejects.toThrow("queue is invalid");
    await AsyncStorage.setItem("budget-tracker-mobile-outbox:alice", "[]");

    await enqueueMutation(mutation({ id: "update-one", operation: "update", recordId: "server-1" }));
    await enqueueMutation(mutation({
      id: "update-two",
      operation: "update",
      recordId: "server-1",
      payload: { amount: 99 },
      optimisticRecord: { id: "server-1", amount: 99 },
    }));
    await expect(getPendingMutations("alice")).resolves.toMatchObject([
      { id: "update-two", payload: { amount: 99 } },
    ]);
  });

  it("handles every household and record endpoint with encoded identifiers", async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => createResource("bills", { title: "Power" }),
      () => updateResource("bills", "bill-1", { status: "Paid" }),
      () => deleteResource("bills", "bill-1"),
      () => fetchHousehold(),
      () => inviteHouseholdMember("a@example.com"),
      () => acceptHouseholdInvite("invite-token"),
      () => removeHouseholdMember("a+b@example.com"),
      () => leaveHousehold(),
    ];
    fetchMock.mockImplementation(async () => response(200, { success: true, role: "none", household: null }));
    for (const call of calls) await call();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("/bills"),
      expect.stringContaining("/bills/bill-1"),
      expect.stringContaining("/bills/bill-1"),
      expect.stringContaining("/household"),
      expect.stringContaining("/household/invite"),
      expect.stringContaining("/household/accept"),
      expect.stringContaining("/household/members/a%2Bb%40example.com"),
      expect.stringContaining("/household/leave"),
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual([
      "POST", "PUT", "DELETE", undefined, "POST", "POST", "DELETE", "POST",
    ]);
  });

  it("fetches the complete mobile snapshot and rejects any failed resource", async () => {
    fetchMock.mockImplementation(async () => response(200, []));
    const snapshot = await fetchMobileSnapshot();
    expect(Object.keys(snapshot)).toHaveLength(15);
    expect(snapshot.expenses).toEqual([]);
    fetchMock.mockImplementationOnce(async () => response(200, []))
      .mockImplementationOnce(async () => response(503, { error: "cards failed" }));
    await expect(fetchMobileSnapshot()).rejects.toMatchObject({ message: "cards failed", status: 503 });
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

  it("replays updates and deletes and accepts numeric server identifiers", async () => {
    await enqueueMutation(mutation({ id: "update", operation: "update", recordId: "server-1" }));
    await enqueueMutation(mutation({ id: "delete", operation: "delete", recordId: "server-2" }));
    fetchMock.mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(200, {}));
    await expect(syncPendingMutations("alice", jest.fn())).resolves.toEqual({ synced: 2, remaining: 0 });
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "PUT" }));
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "DELETE" }));

    await enqueueMutation(mutation({ id: "numeric", recordId: "local-numeric" }));
    fetchMock.mockResolvedValueOnce(response(201, { _id: 42 }));
    const onCreated = jest.fn();
    await expect(syncPendingMutations("alice", onCreated)).resolves.toEqual({ synced: 1, remaining: 0 });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "numeric" }), "42");
  });

  it("retains creates when the server omits the generated identifier", async () => {
    await enqueueMutation(mutation());
    fetchMock.mockResolvedValueOnce(response(201, {}));
    const result = await syncPendingMutations("alice", jest.fn());
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
    expect(result.error).toEqual(expect.objectContaining({ message: expect.stringContaining("did not return an ID") }));
    await expect(getPendingMutations("alice")).resolves.toHaveLength(1);
  });

  it("keeps deletes queued during an in-flight create and then replays them", async () => {
    await enqueueMutation(mutation());
    fetchMock.mockImplementationOnce(async () => {
      await enqueueMutation(mutation({ id: "delete-active", operation: "delete", payload: undefined }));
      return response(201, { id: "server-1" });
    }).mockResolvedValueOnce(response(200, {}));
    await expect(syncPendingMutations("alice", jest.fn())).resolves.toEqual({ synced: 2, remaining: 0 });
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "DELETE" }));
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
