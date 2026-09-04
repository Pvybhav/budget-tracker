import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchBills,
  fetchExpenses,
  fetchIncomes,
  fetchPayments,
  fetchTransfers,
  fetchLoans,
  fetchInsurancePolicies,
} from "../services/backend.service";
import { getEmiSchedule } from "../services/card.service";
import { formatConverted, useDisplayCurrency } from "../services/currency.service";
import { dateOnly, formatDateOnly, formatMonthYear } from "../utils/date";

interface CalendarEvent {
  date: string;
  title: string;
  kind: "income" | "expense" | "bill" | "payment" | "transfer" | "loan" | "insurance";
  amount: number;
  currency?: string;
}
const KIND_STYLE = {
  income: "text-emerald-300",
  expense: "text-rose-300",
  bill: "text-amber-300",
  payment: "text-blue-300",
  transfer: "text-violet-300",
  loan: "text-orange-300",
  insurance: "text-cyan-300",
};

export default function FinancialCalendarPage() {
  const displayCurrency = useDisplayCurrency();
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const bills = useBackendResource(() => fetchBills(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);
  const loans = useBackendResource(() => fetchLoans(), []);
  const policies = useBackendResource(() => fetchInsurancePolicies(), []);
  const events = useMemo<CalendarEvent[]>(() => {
    const inMonth = (date: string) => dateOnly(date).slice(0, 7) === month;
    return [
      ...(bills ?? [])
        .filter((item) => inMonth(item.dueDate))
        .map((item) => ({
          date: dateOnly(item.dueDate),
          title: item.name,
          kind: "bill" as const,
          amount: item.amount,
          currency: item.currency,
        })),
      ...(expenses ?? [])
        .filter((item) => inMonth(item.date))
        .map((item) => ({
          date: item.date.slice(0, 10),
          title: item.details || "Expense",
          kind: "expense" as const,
          amount: item.amount,
          currency: item.currency,
        })),
      ...(incomes ?? [])
        .filter((item) => inMonth(item.date))
        .map((item) => ({
          date: item.date.slice(0, 10),
          title: item.source,
          kind: "income" as const,
          amount: item.amount,
          currency: item.currency,
        })),
      ...(payments ?? [])
        .filter((item) => inMonth(item.date))
        .map((item) => ({
          date: item.date.slice(0, 10),
          title: "Card payment",
          kind: "payment" as const,
          amount: item.amount,
          currency: item.currency,
        })),
      ...(transfers ?? [])
        .filter((item) => inMonth(item.date))
        .map((item) => ({
          date: item.date.slice(0, 10),
          title: "Account transfer",
          kind: "transfer" as const,
          amount: item.amount,
          currency: item.currency,
        })),
      ...(loans ?? []).flatMap((loan) =>
        getEmiSchedule(loan.principal, loan.annualInterestRate, loan.termMonths, loan.startDate)
          .filter((item) => inMonth(item.dueDate))
          .map((item) => ({
            date: item.dueDate,
            title: `${loan.lender} EMI`,
            kind: "loan" as const,
            amount: item.paymentAmount,
            currency: loan.currency,
          })),
      ),
      ...(policies ?? []).flatMap((policy) =>
        (policy.premiumPayments ?? [])
          .filter((payment) => inMonth(payment.date))
          .map((payment) => ({
            date: payment.date,
            title: `${policy.policyName} premium`,
            kind: "insurance" as const,
            amount: payment.amount,
            currency: policy.currency,
          })),
      ),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, [bills, expenses, incomes, loans, month, payments, policies, transfers]);
  const changeMonth = (offset: number) => {
    const date = new Date(`${month}-01T00:00:00`);
    date.setMonth(date.getMonth() + offset);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Financial Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            See money coming in, going out, and becoming due in one timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Previous
          </button>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button
            onClick={() => changeMonth(1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Next
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200">
            <CalendarDays className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            {formatMonthYear(month)}
          </div>
        </div>
        {events.length === 0 ? (
          <p className="p-12 text-center text-slate-600 dark:text-slate-500">
            No financial events in this month.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {events.map((event, index) => (
              <div
                key={`${event.date}-${event.title}-${index}`}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center"
              >
                <time className="w-28 text-sm text-slate-500">{formatDateOnly(event.date)}</time>
                <span className="flex-1 text-slate-800 dark:text-slate-200">
                  {event.title}
                  <span className={`ml-2 text-xs capitalize ${KIND_STYLE[event.kind]}`}>
                    {event.kind}
                  </span>
                </span>
                <span
                  className={`font-medium ${event.kind === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}
                >
                  {formatConverted(event.amount, event.currency, displayCurrency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
