import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchBills,
  fetchExpenses,
  fetchInvestmentTransactions,
  fetchLoans,
} from "../services/backend.service";
import { getBalanceMonthAmountForExpense, getEmiSchedule } from "../services/card.service";
import { getNextRecurringExpenseDue } from "../services/recurring.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";

function dateInMonth(value: string, year: number, month: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return Number(match[1]) === year && Number(match[2]) - 1 === month;
  const date = new Date(value);
  return date.getFullYear() === year && date.getMonth() === month;
}

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nextSubscriptionDueDate(
  dueDate: string,
  frequency: "monthly" | "quarterly" | "yearly",
  year: number,
  month: number,
) {
  const due = localDate(dueDate);
  const target = new Date(year, month, 1);
  const interval = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  while (due < target) {
    const nextMonth = due.getFullYear() * 12 + due.getMonth() + interval;
    const nextYear = Math.floor(nextMonth / 12);
    const monthIndex = nextMonth % 12;
    due.setDate(1);
    due.setFullYear(
      nextYear,
      monthIndex,
      Math.min(Number(dueDate.slice(8, 10)), new Date(nextYear, monthIndex + 1, 0).getDate()),
    );
  }
  return due;
}

export default function UpcomingExpensesPanel() {
  const displayCurrency = useDisplayCurrency();
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const bills = useBackendResource(() => fetchBills(), []);
  const loans = useBackendResource(() => fetchLoans(), []);
  const investmentTransactions = useBackendResource(() => fetchInvestmentTransactions(), []);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const targetMonth = currentMonth + 1;
  const year = currentYear + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const nextMonth = new Date(year, month, 1);

  const amounts = useMemo(() => {
    if (!expenses || !bills || !loans || !investmentTransactions) return undefined;
    const currentMonthExpenses = expenses.reduce(
      (sum, expense) =>
        sum +
        convertCurrency(
          getBalanceMonthAmountForExpense(expense, new Date(currentYear, currentMonth, 1)),
          expense.currency,
          displayCurrency,
        ),
      0,
    );
    const loanPayments = loans.reduce((sum, loan) => {
      if (loan.termMonths <= 0) return sum;
      const paid = new Set(
        (loan.repayments ?? [])
          .filter((repayment) => repayment.paid)
          .map((repayment) => repayment.paymentNumber),
      );
      const due = getEmiSchedule(
        loan.principal,
        loan.annualInterestRate,
        loan.termMonths,
        loan.startDate,
      )
        .filter(
          (payment) =>
            dateInMonth(payment.dueDate, year, month) && !paid.has(payment.paymentNumber),
        )
        .reduce((total, payment) => total + payment.paymentAmount, 0);
      return sum + convertCurrency(due, loan.currency, displayCurrency);
    }, 0);
    const cardEmis = expenses.reduce((sum, expense) => {
      return (
        sum +
        convertCurrency(
          getBalanceMonthAmountForExpense(expense, nextMonth),
          expense.currency,
          displayCurrency,
        )
      );
    }, 0);
    const billPayments = bills.reduce((sum, bill) => {
      const due = bill.isSubscription
        ? nextSubscriptionDueDate(
            bill.dueDate,
            bill.subscriptionFrequency ?? "monthly",
            year,
            month,
          )
        : localDate(bill.dueDate);
      const isDue = due.getFullYear() === year && due.getMonth() === month;
      return (
        sum +
        (isDue && (bill.isSubscription || !bill.paid)
          ? convertCurrency(bill.amount, bill.currency, displayCurrency)
          : 0)
      );
    }, 0);
    const investments = investmentTransactions.reduce(
      (sum, transaction) =>
        sum +
        (transaction.type === "buy" && dateInMonth(transaction.date, year, month)
          ? convertCurrency(transaction.amount, transaction.currency, displayCurrency)
          : 0),
      0,
    );
    const otherExpenses = expenses.reduce((sum, expense) => {
      if (expense.isEmi) return sum;
      const isNextMonthInstance = Boolean(
        expense.isRecurringInstance && dateInMonth(expense.date, year, month),
      );
      const isPlanned = dateInMonth(expense.date, year, month) && !expense.recurringFrequency;
      const recurringTemplate =
        expense.recurringFrequency && !expense.isRecurringInstance
          ? getNextRecurringExpenseDue(expense, expenses)
          : null;
      const nextDue =
        recurringTemplate?.getFullYear() === year && recurringTemplate.getMonth() === month;
      const hasNextInstance = expenses.some(
        (instance) =>
          instance.recurringTemplateId === expense.id && dateInMonth(instance.date, year, month),
      );
      return (
        sum +
        (isNextMonthInstance || isPlanned || (nextDue && !hasNextInstance)
          ? convertCurrency(expense.amount, expense.currency, displayCurrency)
          : 0)
      );
    }, 0);
    return {
      currentMonthExpenses,
      loanPayments,
      cardEmis,
      billPayments,
      investments,
      otherExpenses,
    };
  }, [
    expenses,
    bills,
    loans,
    investmentTransactions,
    currentYear,
    currentMonth,
    year,
    month,
    displayCurrency,
  ]);

  if (!amounts) {
    return (
      <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60" />
    );
  }

  const rows = [
    {
      label: "Next month loan payments",
      amount: amounts.loanPayments,
      to: "/loans",
      description: "View loan repayment schedules and payment status.",
    },
    {
      label: "Next month card EMIs",
      amount: amounts.cardEmis,
      to: "/expenses/emi",
      description: "View expenses currently being paid in installments.",
    },
    {
      label: "This month expenses",
      amount: amounts.currentMonthExpenses,
      to: "/expenses/monthly",
      description: "View expenses recorded this month.",
    },
    {
      label: "Bills due next month",
      amount: amounts.billPayments,
      to: "/bills",
      description: "View bill amounts, due dates, and payment status.",
    },
    {
      label: "Investments / SIPs",
      amount: amounts.investments,
      to: "/investments",
      description: "View your investments and transactions.",
    },
    {
      label: "Other planned expenses",
      amount: amounts.otherExpenses,
      to: "/expenses/monthly",
      description: "View recurring and planned expenses.",
    },
  ] as const;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {nextMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Upcoming expenses
          </h2>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map(({ label, amount, to, description }) => (
          <Tooltip.Root key={label}>
            <div className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
              <Tooltip.Trigger asChild>
                <Link
                  to={to}
                  aria-label={`${label}: ${formatMoney(amount, displayCurrency)}. ${description}`}
                  className="font-medium text-cyan-700 underline decoration-cyan-700/40 underline-offset-2 hover:text-cyan-500 hover:decoration-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300 dark:decoration-cyan-300/40 dark:hover:text-cyan-200"
                >
                  {formatMoney(amount, displayCurrency)}
                </Link>
              </Tooltip.Trigger>
            </div>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={8}
                className="z-50 max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <div className="font-semibold">{label}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {formatMoney(amount, displayCurrency)} · {description}
                </div>
                <Tooltip.Arrow className="fill-white dark:fill-slate-800" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold dark:border-slate-700">
        <span className="text-slate-900 dark:text-slate-100">Estimated total</span>
        <span className="text-rose-600 dark:text-rose-400">
          {formatMoney(total, displayCurrency)}
        </span>
      </div>
    </section>
  );
}
