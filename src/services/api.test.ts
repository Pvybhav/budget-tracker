import { afterEach, describe, expect, it, vi } from "vitest";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import { getNetworkRequestCount, onNetworkLoadingChange, onNetworkToast } from "./network.service";

function response(
  status: number,
  body: string,
  contentType = "application/json",
  statusText = "Request failed",
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    json: async () => JSON.parse(body),
    text: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API requests", () => {
  it("loads JSON with cookies and publishes then clears loading state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, '{"items":[1]}'));
    vi.stubGlobal("fetch", fetchMock);
    const loading: { count: number; message: string }[] = [];
    const unsubscribe = onNetworkLoadingChange((count, message) =>
      loading.push({ count, message }),
    );

    await expect(apiGet<{ items: number[] }>("/expenses?month=1")).resolves.toEqual({ items: [1] });

    expect(fetchMock).toHaveBeenCalledWith("/api/expenses?month=1", { credentials: "include" });
    expect(loading.at(-2)?.count).toBe(1);
    expect(loading.at(-2)?.message).toContain("Loading your expenses");
    expect(loading.at(-1)?.count).toBe(0);
    expect(getNetworkRequestCount()).toBe(0);
    unsubscribe();
  });

  it("uses secure-vault loading text for encrypted vault requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, '{"vault":null}'));
    vi.stubGlobal("fetch", fetchMock);
    const loadingMessages: string[] = [];
    const unsubscribe = onNetworkLoadingChange((_count, message) => loadingMessages.push(message));

    await expect(apiGet<{ vault: null }>("/secure-vault")).resolves.toEqual({ vault: null });

    expect(loadingMessages).toContain("Loading your secure vault…");
    unsubscribe();
  });

  it("posts and updates JSON with credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(201, '{"id":"created"}'))
      .mockResolvedValueOnce(response(200, '{"id":"updated"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/expenses", { amount: 10 })).resolves.toEqual({ id: "created" });
    await expect(apiPut("/expenses/1", { amount: 20 })).resolves.toEqual({ id: "updated" });

    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/expenses",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      }),
    ]);
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "PUT" }));
  });

  it("accepts 204 responses and returns text for non-JSON success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(204, ""))
      .mockResolvedValueOnce(response(200, "plain response", "text/plain"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiDelete("/expenses/1")).resolves.toBeUndefined();
    await expect(apiGet("/export")).resolves.toBe("plain response");
  });

  it("surfaces API errors from JSON bodies and falls back for invalid bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(400, '{"error":"Invalid amount"}'))
      .mockResolvedValueOnce(response(503, "not-json", "application/json", "Service unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/expenses", {})).rejects.toThrow("Invalid amount");
    await expect(apiGet("/health")).rejects.toThrow("Service unavailable");
  });

  it("reports transport errors to the network toast subscribers and rethrows them", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline connection"));
    vi.stubGlobal("fetch", fetchMock);
    const toasts: string[] = [];
    const unsubscribe = onNetworkToast((toast) => toasts.push(`${toast.type}:${toast.message}`));

    await expect(apiGet("/cards")).rejects.toThrow("offline connection");

    expect(toasts).toContain("error:offline connection");
    expect(getNetworkRequestCount()).toBe(0);
    unsubscribe();
  });
});
