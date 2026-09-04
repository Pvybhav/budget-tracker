import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, X } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchBudgetRules,
  fetchCards,
  fetchCategories,
  fetchExpenses,
  fetchInsurancePolicies,
  fetchPayments,
} from "../services/backend.service";
import { getCategoryBudgetAlert } from "../services/budget.service";
import { evaluateBudgetRule } from "../services/budget-rules.service";
import { getAccountAlertStatus, getCardMetrics } from "../services/card.service";
import { getInsurancePolicySummary } from "../services/insurance.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateOnly } from "../utils/date";
interface AlertItem {
  id: string;
  severity: "warning" | "danger";
  title: string;
  message: string;
  detail: string;
}
export default function AlertsPanel() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const insurancePolicies = useBackendResource(() => fetchInsurancePolicies(), []);
  const budgetRules = useBackendResource(() => fetchBudgetRules(), []);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setDismissedIds([]);
  }, [cards?.length, categories?.length]);
  const alerts = useMemo(() => {
    if (!cards || !categories || !expenses || !payments) return [] as AlertItem[];
    const items: AlertItem[] = [];
    for (const category of categories) {
      const alert = getCategoryBudgetAlert(category, expenses, displayCurrency);
      if (!alert) continue;
      items.push({
        id: `category-${category.id}`,
        severity: alert.severity,
        title: `${category.title}`,
        message: alert.message,
        detail: alert.detail,
      });
    }
    for (const card of cards) {
      const cardExpenses = expenses.filter((expense) => expense.cardId === card.id);
      const cardPayments = payments.filter((payment) => payment.cardId === card.id);
      const metrics = getCardMetrics(card, cardExpenses, cardPayments, cards);
      const alert = getAccountAlertStatus(card, metrics);
      if (!alert) continue;
      items.push({
        id: `account-${card.id}`,
        severity: alert.severity,
        title: card.title,
        message: alert.message,
        detail: alert.detail,
      });
    }
    for (const policy of insurancePolicies ?? []) {
      const summary = getInsurancePolicySummary(policy);
      if (summary.status !== "due" && summary.status !== "upcoming") continue;
      items.push({
        id: `insurance-${policy.id}`,
        severity: summary.status === "due" ? "danger" : "warning",
        title: policy.policyName,
        message:
          summary.status === "due"
            ? `Premium of ${formatMoney(convertCurrency(policy.premiumAmount, policy.currency, displayCurrency), displayCurrency)} is due`
            : `Premium of ${formatMoney(convertCurrency(policy.premiumAmount, policy.currency, displayCurrency), displayCurrency)} due soon`,
        detail: `Next due ${formatDateOnly(summary.nextDueDate)}`,
      });
    }
    for (const rule of budgetRules ?? []) {
      const target =
        rule.type === "category"
          ? categories.find((c) => c.id === rule.targetId)
          : cards.find((c) => c.id === rule.targetId);
      const alert = evaluateBudgetRule(rule, expenses, target, displayCurrency);
      if (!alert) continue;
      items.push({
        id: `rule-${rule.id}`,
        severity: alert.severity,
        title: target?.title ?? "Budget rule",
        message: alert.message,
        detail: alert.detail,
      });
    }
    return items
      .filter((item) => !dismissedIds.includes(item.id))
      .sort((a, b) => {
        if (a.severity === b.severity) return 0;
        return a.severity === "danger" ? -1 : 1;
      });
  }, [
    cards,
    categories,
    expenses,
    payments,
    insurancePolicies,
    budgetRules,
    dismissedIds,
    displayCurrency,
  ]);
  if (!cards || !categories) return null;
  const visibleAlerts = showAll ? alerts : alerts.slice(0, 3);
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/60 p-4">
      {" "}
      <div className="flex items-center justify-between mb-3">
        {" "}
        <div>
          {" "}
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
            {" "}
            Alerts{" "}
          </div>{" "}
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {" "}
            Overspend and low-balance warnings{" "}
          </div>{" "}
        </div>{" "}
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {alerts.length} active
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((previous) => !previous)}
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            aria-label={isCollapsed ? "Expand alerts" : "Minimize alerts"}
            title={isCollapsed ? "Expand alerts" : "Minimize alerts"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>{" "}
      {!isCollapsed && (
        <div className="space-y-3">
          {" "}
          {alerts.length === 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
              {" "}
              Everything looks healthy right now.{" "}
            </div>
          )}{" "}
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border px-3 py-3 ${alert.severity === "danger" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}
            >
              {" "}
              <div className="flex items-start gap-2">
                {" "}
                <div
                  className={`mt-0.5 rounded-full p-1 ${alert.severity === "danger" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}
                >
                  {" "}
                  {alert.severity === "danger" ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}{" "}
                </div>{" "}
                <div className="flex-1">
                  {" "}
                  <div className="flex items-center justify-between gap-2">
                    {" "}
                    <p className="text-sm font-semibold text-slate-100"> {alert.title} </p>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${alert.severity === "danger" ? "text-red-300" : "text-amber-300"}`}
                      >
                        {" "}
                        {alert.severity === "danger" ? "Urgent" : "Watch"}{" "}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => setDismissedIds((prev) => [...prev, alert.id])}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        aria-label={`Dismiss ${alert.title} alert`}
                      >
                        {" "}
                        <X className="w-3.5 h-3.5" />{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                  <p className="mt-1 text-sm text-slate-300">{alert.message}</p>{" "}
                  <p className="mt-1 text-xs text-slate-500">{alert.detail}</p>{" "}
                </div>{" "}
              </div>{" "}
            </div>
          ))}{" "}
          {alerts.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((previous) => !previous)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {showAll ? "View fewer alerts" : `View all ${alerts.length} alerts`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
