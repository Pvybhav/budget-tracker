import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/Layout", () => ({
  default: ({ logout }: { logout: () => void }) => (
    <>
      <button onClick={logout}>Mock logout</button>
      <Outlet />
    </>
  ),
}));

vi.mock("./pages/HomePage", () => ({
  default: () => <main>Protected dashboard</main>,
}));

vi.mock("./pages/SecureRecordsPage", () => ({
  default: ({ view }: { view: string }) => <main>Secure records {view}</main>,
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("web app authentication routing", () => {
  beforeEach(() => {
    window.location.hash = "#/";
  });

  it("shows the session loading state before redirecting signed-out users to login", async () => {
    let resolveSession!: (response: Response) => void;
    const session = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(session);
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(screen.getByText("Checking session...")).toBeTruthy();
    resolveSession(jsonResponse(401, {}));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", { credentials: "include" });
  });

  it("routes an authenticated session to the protected app", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    render(<App />);

    expect(await screen.findByText("Protected dashboard")).toBeTruthy();
  });

  it.each([
    ["secure-vault", "credentials"],
    ["personal-records", "personal"],
  ])("opens the %s page for an authenticated session", async (path, view) => {
    window.location.hash = `#/${path}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    render(<App />);

    expect(await screen.findByText(`Secure records ${view}`)).toBeTruthy();
  });

  it("redirects authenticated users away from the login route and handles logout", async () => {
    window.location.hash = "#/login";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    render(<App />);

    expect(await screen.findByText("Protected dashboard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mock logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("routes to the protected app after a successful login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "alex" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Protected dashboard")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/health"));
  });

  it("redirects an unavailable session endpoint to login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("logs failed and unreachable health checks without disrupting the app", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const intervalCallbacks: (() => void)[] = [];
    vi.spyOn(window, "setInterval").mockImplementation((handler, delay) => {
      if (delay === 180_000 && typeof handler === "function") intervalCallbacks.push(handler);
      return setTimeout(() => undefined, 0);
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<App />);

    expect(await screen.findByText("Protected dashboard")).toBeTruthy();
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith("Health check failed with status 503"),
    );
    expect(intervalCallbacks.length).toBeGreaterThan(0);
    await act(async () => {
      intervalCallbacks.at(-1)?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith("Health check failed", expect.any(Error)),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
