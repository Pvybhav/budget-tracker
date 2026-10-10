import { useState } from "react";
import Tooltip from "../components/Tooltip";
import type { AutoCategorizeRule, BudgetRule } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchAutoCategorizeRules,
  fetchBudgetRules,
  fetchCards,
  fetchCategories,
} from "../services/backend.service";
import {
  deleteAutoCategorizeRule,
  deleteBudgetRule,
  updateAutoCategorizeRule,
  updateBudgetRule,
} from "../services/backendSync";
import AddBudgetRuleModal from "../components/modals/AddBudgetRuleModal";
import AddAutoCategorizeRuleModal from "../components/modals/AddAutoCategorizeRuleModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2, ShieldAlert, Tags } from "lucide-react";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
export default function ManageBudgetRulesPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const budgetRules = useBackendResource(() => fetchBudgetRules(), []);
  const autoCategorizeRules = useBackendResource(() => fetchAutoCategorizeRules(), []);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<BudgetRule | undefined>();
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoRuleToEdit, setAutoRuleToEdit] = useState<AutoCategorizeRule | undefined>();
  const [rulePage, setRulePage] = useState(1);
  const [autoRulePage, setAutoRulePage] = useState(1);
  const rulePageSize = 50;
  const visibleRules = (budgetRules ?? []).slice(
    (rulePage - 1) * rulePageSize,
    rulePage * rulePageSize,
  );
  const visibleAutoRules = (autoCategorizeRules ?? []).slice(
    (autoRulePage - 1) * rulePageSize,
    autoRulePage * rulePageSize,
  );
  const targetName = (rule: BudgetRule) => {
    if (rule.type === "category") {
      return categories?.find((c) => c.id === rule.targetId)?.title ?? "Unknown category";
    }
    return cards?.find((c) => c.id === rule.targetId)?.title ?? "Unknown card";
  };
  const categoryName = (rule: AutoCategorizeRule) =>
    categories?.find((c) => c.id === rule.categoryId)?.title ?? "Unknown category";
  const handleDeleteRule = async (rule: BudgetRule) => {
    const ok = await showConfirm(`Delete this budget rule for "${targetName(rule)}"?`, {
      title: "Delete budget rule",
      confirmText: "Delete",
    });
    if (ok) await deleteBudgetRule(rule.id!);
  };
  const handleDeleteAutoRule = async (rule: AutoCategorizeRule) => {
    const ok = await showConfirm(`Delete auto-categorize rule for "${rule.keyword}"?`, {
      title: "Delete rule",
      confirmText: "Delete",
    });
    if (ok) await deleteAutoCategorizeRule(rule.id!);
  };
  const toggleRuleEnabled = async (rule: BudgetRule) => {
    await updateBudgetRule(rule.id!, { enabled: !rule.enabled });
  };
  const toggleAutoRuleEnabled = async (rule: AutoCategorizeRule) => {
    await updateAutoCategorizeRule(rule.id!, { enabled: !rule.enabled });
  };
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Budget Rules & Automation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Flag overspending on categories or cards, and auto-categorize expenses by keyword.
        </p>
      </div>
      {/* Budget Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Spending Threshold Rules
            </h2>
          </div>
          <button
            onClick={() => {
              setRuleToEdit(undefined);
              setIsRuleModalOpen(true);
            }}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
        {!budgetRules || budgetRules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-950/40 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No budget rules yet. e.g. "Flag if Groceries exceed ₹2000".
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-700 dark:text-slate-400">
                        {rule.type}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {targetName(rule)}
                      </h3>
                      {!rule.enabled && (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-500">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-400">
                      Flag if spend exceeds{" "}
                      {formatMoney(
                        convertCurrency(rule.thresholdAmount, rule.currency, displayCurrency),
                        displayCurrency,
                      )}
                      per {rule.period.replace("ly", "")} {rule.note ? ` · ${rule.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRuleEnabled(rule)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                    <Tooltip content="Edit rule">
                      <button
                        onClick={() => {
                          setRuleToEdit(rule);
                          setIsRuleModalOpen(true);
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete rule">
                      <button
                        onClick={() => handleDeleteRule(rule)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              page={rulePage}
              totalItems={budgetRules.length}
              pageSize={rulePageSize}
              onPageChange={setRulePage}
            />
          </>
        )}
      </div>
      {/* Auto-Categorize Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Auto-Categorize Rules
            </h2>
          </div>
          <button
            onClick={() => {
              setAutoRuleToEdit(undefined);
              setIsAutoModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
        {!autoCategorizeRules || autoCategorizeRules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-950/40 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No auto-categorize rules yet. Expenses whose description contains a keyword will be
            auto-assigned to the matching category.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleAutoRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
                    rule.enabled
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-slate-300 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        "{rule.keyword}"
                      </h3>
                      <span className="text-slate-500">→</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {categoryName(rule)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          rule.enabled
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAutoRuleEnabled(rule)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        rule.enabled
                          ? "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-slate-400/40 text-slate-600 hover:bg-slate-500/10 dark:text-slate-300"
                      }`}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                    <Tooltip content="Edit rule">
                      <button
                        onClick={() => {
                          setAutoRuleToEdit(rule);
                          setIsAutoModalOpen(true);
                        }}
                        className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2 text-indigo-600 transition-colors hover:bg-indigo-500/15 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete rule">
                      <button
                        onClick={() => handleDeleteAutoRule(rule)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 text-rose-600 transition-colors hover:bg-rose-500/15 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              page={autoRulePage}
              totalItems={autoCategorizeRules.length}
              pageSize={rulePageSize}
              onPageChange={setAutoRulePage}
            />
          </>
        )}
      </div>
      <AddBudgetRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        initialRule={ruleToEdit}
        categories={categories ?? []}
        cards={cards ?? []}
      />
      <AddAutoCategorizeRuleModal
        isOpen={isAutoModalOpen}
        onClose={() => setIsAutoModalOpen(false)}
        initialRule={autoRuleToEdit}
        categories={categories ?? []}
      />
    </div>
  );
}
