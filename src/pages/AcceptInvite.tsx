import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { acceptHouseholdInvite } from "../services/backendSync";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");
  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This invite link is missing its token.");
      return;
    }
    void (async () => {
      try {
        await acceptHouseholdInvite(token);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to accept invite");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-slate-900 dark:text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        {status === "pending" && <p>Joining household...</p>}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500 dark:text-emerald-400" />
            <p className="mb-4 text-lg font-medium">You've joined the household!</p>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg bg-emerald-600 dark:bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:hover:bg-emerald-700"
            >
              Go to Dashboard
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-3 h-10 w-10 text-rose-500 dark:text-rose-400" />
            <p className="mb-4 text-slate-600 dark:text-slate-300">{message}</p>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
