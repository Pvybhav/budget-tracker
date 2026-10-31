import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("sign-in and account creation", () => {
  it("submits login credentials and reports authentication success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    const onAuthenticated = vi.fn();

    render(
      <MemoryRouter>
        <LoginPage onAuthenticated={onAuthenticated} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alex" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ username: "alex", password: "secret" }),
      }),
    );
  });

  it("switches to signup and sends the full name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, {}));
    vi.stubGlobal("fetch", fetchMock);
    const onAuthenticated = vi.fn();

    render(
      <MemoryRouter>
        <LoginPage onAuthenticated={onAuthenticated} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alex" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({
        body: JSON.stringify({ username: "alex", password: "secret", fullName: "Alex Morgan" }),
      }),
    );
  });

  it("shows API and network errors without authenticating", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Invalid username or password" }))
      .mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const onAuthenticated = vi.fn();

    render(
      <MemoryRouter>
        <LoginPage onAuthenticated={onAuthenticated} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alex" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid username or password")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("network unavailable")).toBeTruthy();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
