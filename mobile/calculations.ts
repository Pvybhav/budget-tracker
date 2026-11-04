export type MobileExpense = {
  amount: number;
  date: string;
  category?: string;
  isEmi?: boolean;
  emiStartDate?: string;
  emiMonths?: number;
  emiInterestRate?: number;
  emiProcessingFee?: number;
  emiGst?: number;
};

export type MobileBudget = {
  title: string;
  budgetAmount: number;
  budgetMode: "monthly" | "quarterly" | "yearly";
};

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "SGD" | "AED" | "CNY";

const usdRates: Record<CurrencyCode, number> = {
  USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 149.5,
  AUD: 1.52, CAD: 1.36, SGD: 1.34, AED: 3.67, CNY: 7.24,
};

export function convertCurrency(amount: number, from: CurrencyCode = "INR", to: CurrencyCode = "INR") {
  return from === to ? amount : (amount / (usdRates[from] ?? 1)) * (usdRates[to] ?? 1);
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return parseDate(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return parseDate(value);
  return parsed;
}

function calendarToday(now: Date) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function addCalendarMonths(date: Date, months: number) {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDay),
  ));
}

function formatCalendarDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type RecurringRecord = {
  date: string;
  recurringFrequency?: "weekly" | "monthly" | "yearly";
  recurringInterval?: number;
  recurringEndDate?: string;
};

export function getNextRecurringDue(record: RecurringRecord, now = new Date()) {
  if (!record.recurringFrequency) return null;
  const start = parseCalendarDate(record.date);
  const today = calendarToday(now);
  const interval = Math.max(1, record.recurringInterval ?? 1);
  let occurrences = 0;
  let next = start;
  while (next <= today) {
    occurrences += 1;
    if (record.recurringFrequency === "weekly") {
      next = new Date(start);
      next.setUTCDate(next.getUTCDate() + 7 * interval * occurrences);
    } else {
      next = addCalendarMonths(start, (record.recurringFrequency === "yearly" ? 12 : 1) * interval * occurrences);
    }
  }
  if (record.recurringEndDate && next > parseCalendarDate(record.recurringEndDate)) return null;
  return formatCalendarDate(next);
}

export function calculateBudgetCarryover(budget: number, spent: number, previousCarryover = 0) {
  return Math.max(0, budget + previousCarryover - spent);
}

export function calculateNetWorth(assets: number, liabilities: number) {
  return assets - liabilities;
}

export function calculateInvestmentReturn(invested: number, currentValue: number) {
  return {
    profit: currentValue - invested,
    percentage: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
  };
}

export type InsurancePolicyInput = {
  startDate: string;
  endDate?: string;
  premiumFrequency: "monthly" | "quarterly" | "half-yearly" | "yearly";
  premiumPayments?: { amount: number; date: string }[];
};

export function getInsuranceSummary(policy: InsurancePolicyInput, today = new Date()) {
  const payments = policy.premiumPayments ?? [];
  const lastPaid = payments.map((payment) => parseCalendarDate(payment.date)).sort((a, b) => b.getTime() - a.getTime())[0];
  let nextDue = parseCalendarDate(policy.startDate);
  if (lastPaid) {
    const months = policy.premiumFrequency === "monthly" ? 1 : policy.premiumFrequency === "quarterly" ? 3 : policy.premiumFrequency === "half-yearly" ? 6 : 12;
    nextDue = addCalendarMonths(lastPaid, months);
  }
  const todayDate = calendarToday(today);
  const daysUntilDue = (nextDue.getTime() - todayDate.getTime()) / 86400000;
  return {
    nextDueDate: formatCalendarDate(nextDue),
    daysUntilDue,
    totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
    status: policy.endDate && parseCalendarDate(policy.endDate) < todayDate ? "expired" : daysUntilDue <= 0 ? "due" : daysUntilDue <= 15 ? "upcoming" : "ok",
  };
}

export function calcMonthlyEmi(principal: number, annualRatePct: number, months: number) {
  if (months <= 0) return 0;
  if (annualRatePct === 0) return principal / months;
  const monthlyRate = annualRatePct / 100 / 12;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

export function getMonthlyExpenseAmount(expense: MobileExpense, month: Date) {
  if (!expense.isEmi) {
    const date = parseDate(expense.date);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
      ? expense.amount
      : 0;
  }
  const start = parseDate(expense.emiStartDate ?? expense.date);
  const months = Math.max(expense.emiMonths ?? 1, 1);
  const monthIndex =
    (month.getFullYear() - start.getFullYear()) * 12 + month.getMonth() - start.getMonth();
  if (monthIndex < 0 || monthIndex >= months) return 0;
  return (
    calcMonthlyEmi(expense.amount, expense.emiInterestRate ?? 0, months) +
    (expense.emiProcessingFee ?? 0) / months +
    (expense.emiGst ?? 0) / months
  );
}

export type EmiScheduleEntry = {
  paymentNumber: number;
  dueDate: string;
  paymentAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
  status: "completed" | "due" | "upcoming";
};

export function getEmiSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  startDate: string,
): EmiScheduleEntry[] {
  const monthlyRate = annualRatePct / 100 / 12;
  const monthlyPayment = calcMonthlyEmi(principal, annualRatePct, months);
  let balance = principal;
  const start = parseCalendarDate(startDate);
  const today = calendarToday(new Date());
  return Array.from({ length: months }, (_, index) => {
    const due = addCalendarMonths(start, index);
    const interestAmount = monthlyRate > 0 ? balance * monthlyRate : 0;
    let principalAmount = monthlyPayment - interestAmount;
    if (index === months - 1) principalAmount = balance;
    const paymentAmount = principalAmount + interestAmount;
    balance = Math.max(0, balance - principalAmount);
    const status = due < today ? "completed" : due.getUTCFullYear() === today.getUTCFullYear() && due.getUTCMonth() === today.getUTCMonth() ? "due" : "upcoming";
    return {
      paymentNumber: index + 1,
      dueDate: formatCalendarDate(due),
      paymentAmount,
      principalAmount,
      interestAmount,
      remainingBalance: balance,
      status,
    };
  });
}

function effectiveBudget(budget: MobileBudget) {
  if (budget.budgetMode === "monthly") return budget.budgetAmount;
  if (budget.budgetMode === "quarterly") return budget.budgetAmount / 3;
  return budget.budgetAmount / 12;
}

export function forecastBudget(budget: MobileBudget, expenses: MobileExpense[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodExpenses = expenses.filter((expense) => {
    const date = parseDate(expense.date);
    return expense.category === budget.title && date >= start && date <= end;
  });
  const spent = periodExpenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, now), 0);
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = end.getDate();
  const projectedSpent = (spent / daysElapsed) * daysInMonth;
  const limit = effectiveBudget(budget);
  return {
    spent,
    projectedSpent,
    limit,
    percentage: limit > 0 ? (projectedSpent / limit) * 100 : 0,
    willExceed: projectedSpent > limit,
  };
}

export function compareMonthlySpending(expenses: MobileExpense[]) {
  const now = new Date();
  const totalFor = (offset: number) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, date), 0);
  };
  const current = totalFor(0);
  const previous = totalFor(1);
  return {
    current,
    previous,
    changePercent: previous > 0 ? ((current - previous) / previous) * 100 : 0,
  };
}
