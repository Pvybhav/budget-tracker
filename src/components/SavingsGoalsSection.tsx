import { useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { Plus, Target, TrendingUp, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { type SavingsGoal } from "../db/db";
import { deleteSavingsGoal } from "../services/backendSync";
import { fetchSavingsGoals } from "../services/backend.service";
import { getSavingsGoalSummary } from "../services/savingsGoal.service";
import showConfirm from "./Confirm";
import AddSavingsGoalModal from "./modals/AddSavingsGoalModal";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "./PaginationControls";
import SavingsContributionPanel from "./SavingsContributionPanel";

type GoalFilter = "all" | "active" | "completed" | "overdue";

export default function SavingsGoalsSection() {
  const displayCurrency = useDisplayCurrency();
  const goals = useBackendResource(() => fetchSavingsGoals(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | undefined>();
  const [goalFilter, setGoalFilter] = useState<GoalFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const goalRows = useMemo(
    () => (goals ?? []).map((goal) => ({ goal, summary: getSavingsGoalSummary(goal) })),
    [goals],
  );
  const filteredGoals = useMemo(
    () =>
      goalRows.filter(({ goal, summary }) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          goal.title.toLowerCase().includes(query) ||
          goal.note?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
        if (goalFilter === "completed") return summary.status === "Completed";
        if (goalFilter === "overdue") return summary.status === "Overdue";
        if (goalFilter === "active") return summary.status !== "Completed";
        return true;
      }),
    [goalRows, goalFilter, search],
  );
  const visibleGoals = filteredGoals.slice((page - 1) * pageSize, page * pageSize);
  const goalTotals = useMemo(
    () => ({
      target: goalRows.reduce(
        (total, { goal }) =>
          total + convertCurrency(goal.targetAmount, goal.currency, displayCurrency),
        0,
      ),
      saved: goalRows.reduce(
        (total, { goal }) =>
          total + convertCurrency(goal.currentAmount, goal.currency, displayCurrency),
        0,
      ),
      completed: goalRows.filter(({ summary }) => summary.status === "Completed").length,
    }),
    [goalRows, displayCurrency],
  );

  const openCreateModal = () => {
    setSelectedGoal(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setIsModalOpen(true);
  };

  const deleteGoal = async (id?: string) => {
    if (!id) return;
    const ok = await showConfirm("Delete this savings goal?", {
      title: "Delete goal",
      confirmText: "Delete",
    });
    if (ok) await deleteSavingsGoal(id);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
            Savings Goals
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
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

      {goalRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">Goals</div>
              <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {goalRows.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">Saved</div>
              <div className="mt-1 text-xl font-semibold text-emerald-500">
                {formatMoney(goalTotals.saved, displayCurrency)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">Target</div>
              <div className="mt-1 text-xl font-semibold text-cyan-500">
                {formatMoney(goalTotals.target, displayCurrency)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">Completed</div>
              <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {goalTotals.completed}
              </div>
            </div>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search goals or notes"
            aria-label="Search savings goals"
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter savings goals">
            {(["all", "active", "completed", "overdue"] as GoalFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setGoalFilter(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${goalFilter === filter ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </>
      )}

      {filteredGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {goalRows.length === 0
            ? "No savings goals yet. Create one to start planning ahead."
            : "No goals match your search or filter."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGoals.map(({ goal, summary }) => {
            let progressColor = "bg-gradient-to-r from-emerald-400 to-cyan-400";
            if (summary.status === "Completed") progressColor = "bg-emerald-400";
            if (summary.status === "Overdue") progressColor = "bg-rose-400";
            const daysLabel = `${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"} left`;
            return (
              <div
                key={goal.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-400" />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {goal.title}
                      </h3>
                      <span className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-700 dark:text-slate-400">
                        {summary.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      Target:{" "}
                      {formatMoney(
                        convertCurrency(goal.targetAmount, goal.currency, displayCurrency),
                        displayCurrency,
                      )}{" "}
                      by {goal.targetDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(goal)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Edit goal"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${progressColor}`}
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
                      {formatMoney(
                        convertCurrency(goal.currentAmount, goal.currency, displayCurrency),
                        displayCurrency,
                      )}{" "}
                      /{" "}
                      {formatMoney(
                        convertCurrency(goal.targetAmount, goal.currency, displayCurrency),
                        displayCurrency,
                      )}
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
                      {formatMoney(
                        convertCurrency(summary.remainingAmount, goal.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      {summary.daysLeft > 0 ? daysLabel : "Target date reached"}
                    </div>
                  </div>
                </div>

                {goal.note && (
                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-400">{goal.note}</div>
                )}
                <SavingsContributionPanel goal={goal} />
              </div>
            );
          })}
        </div>
      )}
      <PaginationControls
        page={page}
        totalItems={filteredGoals.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

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
