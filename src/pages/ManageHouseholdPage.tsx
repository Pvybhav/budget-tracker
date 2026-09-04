import { useState } from "react";
import { Users, UserPlus, Trash2, LogOut, Copy } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchHousehold } from "../services/backend.service";
import {
  inviteHouseholdMember,
  removeHouseholdMember,
  leaveHousehold,
} from "../services/backendSync";
import showConfirm, { showAlert } from "../components/Confirm";
import PaginationControls from "../components/PaginationControls";

export default function ManageHouseholdPage() {
  const status = useBackendResource(() => fetchHousehold(), []);
  const [email, setEmail] = useState("");
  const [lastInvite, setLastInvite] = useState<{ email: string; acceptUrl: string } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const members = status?.household?.members ?? [];
  const visibleMembers = members.slice((page - 1) * pageSize, page * pageSize);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const result = await inviteHouseholdMember(email.trim());
    const acceptUrl = `${window.location.origin}${window.location.pathname}#/accept-invite?token=${result.inviteToken}`;
    setLastInvite({ email: result.email, acceptUrl });
    setEmail("");
  };

  const handleRemove = async (memberEmail: string) => {
    const ok = await showConfirm(`Remove ${memberEmail} from your household?`, {
      title: "Remove member",
      confirmText: "Remove",
    });
    if (ok) await removeHouseholdMember(memberEmail);
  };

  const handleLeave = async () => {
    const ok = await showConfirm("Leave this household? You'll return to your own data.", {
      title: "Leave household",
      confirmText: "Leave",
    });
    if (ok) await leaveHousehold();
  };

  const copyLink = async (acceptUrl: string) => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      await showAlert("Invite link copied to clipboard");
    } catch {
      await showAlert(acceptUrl);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Household</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Share full read/write access to your data with people you invite by email. There is no
          email delivery configured for this app, so share the invite link yourself.
        </p>
      </div>

      {status?.role === "member" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-300">
            You are a member of another household and are currently viewing that owner's data.
          </p>
          <button
            onClick={handleLeave}
            className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Leave household
          </button>
        </div>
      )}

      {status?.role !== "member" && (
        <>
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex-1">
              <label
                className="mb-1 block text-sm text-slate-600 dark:text-slate-400"
                htmlFor="invite-email"
              >
                Invite by email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="someone@example.com"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" /> Invite
            </button>
          </form>

          {lastInvite && (
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-700/40 bg-emerald-500/10 p-4 text-sm text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Invite created for <strong>{lastInvite.email}</strong>. Share this link with them:
                <br />
                <code className="break-all text-emerald-100">{lastInvite.acceptUrl}</code>
              </span>
              <button
                onClick={() => copyLink(lastInvite.acceptUrl)}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-600 px-3 py-1.5 text-emerald-200 hover:bg-emerald-500/20"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Users className="h-5 w-5" /> Members
            </h2>
            {!status?.household?.members.length && (
              <p className="text-sm text-slate-600 dark:text-slate-500">
                You haven't invited anyone yet. Everyone you invite gets full access to your data.
              </p>
            )}
            <div className="space-y-2">
              {visibleMembers.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="text-slate-800 dark:text-slate-200">{member.email}</p>
                    <p className="text-xs capitalize text-slate-500 dark:text-slate-500">
                      {member.status}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(member.email)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <PaginationControls
              page={page}
              totalItems={members.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
