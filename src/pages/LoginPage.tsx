import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
type LoginPageProps = { onAuthenticated: () => void };
export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          mode === "login" ? { username, password } : { username, password, fullName },
        ),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Authentication failed.");
      }
      onAuthenticated();
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
      {" "}
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        {" "}
        <div className="mb-6 text-center">
          {" "}
          <p className="text-sm uppercase tracking-[0.24em] text-blue-400">Budget Tracker</p>{" "}
          <h1 className="mt-3 text-3xl font-bold text-white">
            {" "}
            {mode === "login" ? "Sign in" : "Create account"}{" "}
          </h1>{" "}
        </div>{" "}
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
          {" "}
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "login" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"}`}
          >
            {" "}
            Login{" "}
          </button>{" "}
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"}`}
          >
            {" "}
            Sign up{" "}
          </button>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="space-y-5">
          {" "}
          {mode === "signup" && (
            <label className="block">
              {" "}
              <span className="mb-2 block text-sm text-slate-300">Full name</span>{" "}
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-blue-500"
                autoComplete="name"
                placeholder="Jane Doe"
              />{" "}
            </label>
          )}{" "}
          <label className="block">
            {" "}
            <span className="mb-2 block text-sm text-slate-300">Username</span>{" "}
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-blue-500"
              autoComplete="username"
            />{" "}
          </label>{" "}
          <label className="block">
            {" "}
            <span className="mb-2 block text-sm text-slate-300">Password</span>{" "}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-blue-500"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />{" "}
          </label>{" "}
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {" "}
              {error}{" "}
            </div>
          )}{" "}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {" "}
            {isSubmitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}{" "}
          </button>{" "}
        </form>{" "}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
          {" "}
          {mode === "login" ? (
            <>
              {" "}
              Demo credentials: <span className="font-medium text-slate-200">admin</span> /{" "}
              <span className="font-medium text-slate-200">admin123</span>{" "}
            </>
          ) : (
            <> Passwords must be at least 8 characters long. </>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
