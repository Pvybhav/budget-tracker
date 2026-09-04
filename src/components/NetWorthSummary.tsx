import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchCards,
  fetchExpenses,
  fetchLoans,
  fetchPayments,
  fetchInvestments,
} from "../services/backend.service";
import { getCardMetrics } from "../services/card.service";
import { getAccountTypeLabel, getLoanRemainingBalance } from "../services/netWorth.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
export default function NetWorthSummary() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const loans = useBackendResource(() => fetchLoans(), []);
  const investments = useBackendResource(() => fetchInvestments(), []);
  const summary = useMemo(() => {
    if (!cards || !expenses || !payments || !loans || !investments) return undefined;
    const accountGroups = new Map<string, number>();
    let assets = 0;
    let cardLiabilities = 0;
    for (const card of cards) {
      const metrics = getCardMetrics(
        card,
        expenses.filter((expense) => expense.cardId === card.id),
        payments.filter((payment) => payment.cardId === card.id),
        cards,
      );
      const balance = convertCurrency(
        card.type === "credit" ? (metrics.amountOwed ?? 0) : Math.max(0, metrics.currentBalance),
        card.currency,
        displayCurrency,
      );
      const group = getAccountTypeLabel(card);
      if (card.type === "credit") {
        cardLiabilities += balance;
      } else {
        assets += balance;
        accountGroups.set(group, (accountGroups.get(group) ?? 0) + balance);
      }
    }
    const loanLiabilities = loans.reduce(
      (total, loan) =>
        total + convertCurrency(getLoanRemainingBalance(loan), loan.currency, displayCurrency),
      0,
    );
    const investmentValue = investments.reduce(
      (total, investment) =>
        total + convertCurrency(investment.currentValue, investment.currency, displayCurrency),
      0,
    );
    if (investmentValue > 0) {
      assets += investmentValue;
      accountGroups.set("Investments", investmentValue);
    }
    return {
      assets,
      cardLiabilities,
      loanLiabilities,
      netWorth: assets - cardLiabilities - loanLiabilities,
      accountGroups: Array.from(accountGroups.entries()).sort(
        ([, first], [, second]) => second - first,
      ),
    };
  }, [cards, expenses, investments, loans, payments, displayCurrency]);
  if (!summary) {
    return (
      <div className="h-48 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60" />
    );
  }
  const liabilities = summary.cardLiabilities + summary.loanLiabilities;
  const metricItems = [
    { label: "Assets", value: summary.assets, color: "text-emerald-400" },
    { label: "Liabilities", value: liabilities, color: "text-rose-400" },
    {
      label: "Net worth",
      value: summary.netWorth,
      color:
        summary.netWorth >= 0
          ? "text-slate-900 dark:text-slate-100"
          : "text-rose-600 dark:text-rose-400",
    },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
      {" "}
      <div className="flex items-start justify-between gap-4">
        {" "}
        <div>
          {" "}
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {" "}
            All accounts{" "}
          </div>{" "}
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {" "}
            Net worth snapshot{" "}
          </h2>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Accounts, investments, and loans in one view.{" "}
          </p>{" "}
        </div>{" "}
        <Landmark className="h-5 w-5 text-cyan-400" />{" "}
      </div>{" "}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {" "}
        {metricItems.map((item) => (
          <div key={item.label}>
            {" "}
            <div className="text-sm text-slate-400">{item.label}</div>{" "}
            <div className={`mt-1 text-xl font-semibold ${item.color}`}>
              {" "}
              {formatMoney(item.value, displayCurrency)}{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      <div className="mt-5 grid gap-3 border-t border-slate-200 dark:border-slate-800 pt-4 sm:grid-cols-2">
        {" "}
        <div className="space-y-2">
          {" "}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {" "}
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" /> Asset balances{" "}
          </div>{" "}
          {summary.accountGroups.length > 0 ? (
            summary.accountGroups.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                {" "}
                <span className="text-slate-400">{label}</span>{" "}
                <span className="font-medium text-slate-200">
                  {" "}
                  {formatMoney(value, displayCurrency)}{" "}
                </span>{" "}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">No asset accounts yet.</div>
          )}{" "}
        </div>{" "}
        <div className="space-y-2">
          {" "}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {" "}
            <ArrowDownLeft className="h-3.5 w-3.5 text-rose-400" /> Debt balances{" "}
          </div>{" "}
          <div className="flex items-center justify-between text-sm">
            {" "}
            <span className="text-slate-400">Credit cards</span>{" "}
            <span className="font-medium text-slate-200">
              {" "}
              {formatMoney(summary.cardLiabilities, displayCurrency)}{" "}
            </span>{" "}
          </div>{" "}
          <div className="flex items-center justify-between text-sm">
            {" "}
            <span className="text-slate-400">Loans</span>{" "}
            <span className="font-medium text-slate-200">
              {" "}
              {formatMoney(summary.loanLiabilities, displayCurrency)}{" "}
            </span>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </section>
  );
}
