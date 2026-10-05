import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchBills,
  fetchExpenses,
  fetchInvestmentTransactions,
  fetchLoans,
} from "../services/backend.service";
import { calcMonthlyEmi, getEmiSchedule } from "../services/card.service";
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
        (dateInMonth(expense.date, currentYear, currentMonth)
          ? convertCurrency(expense.amount, expense.currency, displayCurrency)
          : 0),
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
      if (!expense.isEmi || !expense.emiMonths) return sum;
      const start = localDate(expense.date);
      const monthOffset = (year - start.getFullYear()) * 12 + month - start.getMonth();
      if (monthOffset < 0 || monthOffset >= expense.emiMonths) return sum;
      const amount = calcMonthlyEmi(
        expense.amount,
        expense.emiInterestRate ?? 0,
        expense.emiMonths,
      );
      return sum + convertCurrency(amount, expense.currency, displayCurrency);
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
    ["Next month loan payments", amounts.loanPayments],
    ["Next month card EMIs", amounts.cardEmis],
    ["This month expenses", amounts.currentMonthExpenses],
    ["Bills due next month", amounts.billPayments],
    ["Investments / SIPs", amounts.investments],
    ["Other planned expenses", amounts.otherExpenses],
  ] as const;
  const total = rows.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
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
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(amount, displayCurrency)}
            </span>
          </div>
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
