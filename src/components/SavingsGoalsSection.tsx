import { useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import {
  Plus,
  Target,
  TrendingUp,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react";
import { type SavingsGoal } from "../db/db";
import { deleteSavingsGoal } from "../services/backendSync";
import { fetchSavingsGoals } from "../services/backend.service";
import { getSavingsGoalSummary } from "../services/savingsGoal.service";
import AddSavingsGoalModal from "./modals/AddSavingsGoalModal";

export default function SavingsGoalsSection() {
  const goals = useBackendResource(() => fetchSavingsGoals(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | undefined>();

  const sortedGoals = useMemo(() => {
    return [...(goals ?? [])].sort((a, b) =>
      a.targetDate.localeCompare(b.targetDate),
    );
  }, [goals]);

  const openCreateModal = () => {
    setSelectedGoal(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setIsModalOpen(true);
  };

  const deleteGoal = async (id?: number) => {
    if (!id) return;
    await deleteSavingsGoal(id);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Savings Goals
          </div>
          <div className="text-lg font-bold text-slate-100">
            Create goals, track progress, and estimate your ETA
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      {sortedGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          No savings goals yet. Create one to start planning ahead.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGoals.map((goal) => {
            const summary = getSavingsGoalSummary(goal);
            return (
              <div
                key={goal.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-400" />
                      <h3 className="font-semibold text-slate-100">
                        {goal.title}
                      </h3>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                        {summary.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      Target: ₹{goal.targetAmount.toFixed(2)} by{" "}
                      {goal.targetDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(goal)}
                      className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
                      title="Edit goal"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-400"
                      title="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    style={{ width: `${summary.progressPercent}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Progress
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      ₹{goal.currentAmount.toFixed(2)} / ₹
                      {goal.targetAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">
                      {summary.progressPercent}% complete
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <CalendarDays className="h-4 w-4 text-cyan-400" />
                      ETA
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      {summary.etaLabel}
                    </div>
                    <div className="text-sm text-slate-400">
                      {summary.estimatedCompletionDate
                        ? `Estimated ${summary.estimatedCompletionDate}`
                        : "Target date is in view"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-sm text-slate-400">Need to save</div>
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      ₹{summary.remainingAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">
                      {summary.daysLeft > 0
                        ? `${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"} left`
                        : "Target date reached"}
                    </div>
                  </div>
                </div>

                {goal.note && (
                  <div className="mt-3 text-sm text-slate-400">{goal.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddSavingsGoalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedGoal(undefined);
        }}
        initialGoal={selectedGoal}
      />
    </div>
  );
}
