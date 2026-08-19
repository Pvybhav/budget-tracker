import type { Card, Expense, Payment } from '../db/db';

/**
 * Months between two dates (year*12 + month arithmetic — ignores day).
 * Positive when date2 is later than date1.
 */
function monthsBetween(date1: Date, date2: Date): number {
  return (date2.getFullYear() - date1.getFullYear()) * 12 +
    (date2.getMonth() - date1.getMonth());
}

/**
 * Monthly EMI amount for the principal using the reducing-balance formula.
 * For 0% interest simply returns principal / months.
 */
export function calcMonthlyEmi(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  if (annualRatePct === 0) return principal / months;
  const r = annualRatePct / 100 / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/**
 * Total amount that an EMI purchase costs over its full tenure.
 * This is what gets blocked from the credit limit and counted toward AMC waiver.
 *   = (monthlyEmi × months) + processingFee + gst
 */
export function calcEmiTotalCost(
  principal: number,
  annualRatePct: number,
  months: number,
  processingFee: number,
  gst: number,
): number {
  const monthlyEmi = calcMonthlyEmi(principal, annualRatePct, months);
  return monthlyEmi * months + processingFee + gst;
}

export type EmiScheduleStatus = "completed" | "due" | "upcoming";

export interface EmiScheduleEntry {
  paymentNumber: number;
  dueDate: string;
  paymentAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
  status: EmiScheduleStatus;
}

function getScheduleStatus(dueDate: Date): EmiScheduleStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    return "completed";
  }

  if (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth()
  ) {
    return "due";
  }

  return "upcoming";
}

export function getEmiSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  startDate: string,
): EmiScheduleEntry[] {
  const monthlyRate = annualRatePct / 100 / 12;
  const monthlyPayment = calcMonthlyEmi(principal, annualRatePct, months);
  let balance = principal;
  const start = new Date(startDate);

  return Array.from({ length: months }, (_, index) => {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + index);

    const interestAmount = monthlyRate > 0 ? balance * monthlyRate : 0;
    let principalAmount = monthlyPayment - interestAmount;

    if (index === months - 1) {
      principalAmount = balance;
    }

    const paymentAmount = principalAmount + interestAmount;
    balance = Math.max(0, balance - principalAmount);

    return {
      paymentNumber: index + 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      paymentAmount,
      principalAmount,
      interestAmount,
      remainingBalance: balance,
      status: getScheduleStatus(dueDate),
    };
  });
}

export interface AccountAlertStatus {
  severity: 'warning' | 'danger';
  message: string;
  detail: string;
}

function getLinkedCardIds(card: Card, allCards: Card[] = []): number[] {
  const linkedIds = card.linkedCardIds ?? [];
  const normalized = linkedIds.filter((id) => typeof id === 'number' && id > 0);
  const cardId = card.id;

  if (cardId == null) {
    return normalized;
  }

  const fromOtherCards = allCards
    .filter((candidate) => candidate.id !== cardId && (candidate.linkedCardIds ?? []).includes(cardId))
    .map((candidate) => candidate.id)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  return Array.from(new Set([...normalized, ...fromOtherCards]));
}

function getCardScopeExpenses(card: Card, expenses: Expense[], allCards: Card[] = []): Expense[] {
  const linkedCardIds = getLinkedCardIds(card, allCards);
  const scopeCardIds = card.id != null ? [card.id, ...linkedCardIds] : linkedCardIds;

  if (scopeCardIds.length === 0) {
    return expenses;
  }

  return expenses.filter((expense) => scopeCardIds.includes(expense.cardId));
}

function getCardScopePayments(card: Card, payments: Payment[], allCards: Card[] = []): Payment[] {
  const linkedCardIds = getLinkedCardIds(card, allCards);
  const scopeCardIds = card.id != null ? [card.id, ...linkedCardIds] : linkedCardIds;

  if (scopeCardIds.length === 0) {
    return payments;
  }

  return payments.filter((payment) => scopeCardIds.includes(payment.cardId));
}

export function getCardMetrics(card: Card, expenses: Expense[], payments: Payment[], allCards: Card[] = []) {
  const today = new Date();
  const isCreditAccount = card.type === 'credit';
  const scopeExpenses = getCardScopeExpenses(card, expenses, allCards);
  const scopePayments = getCardScopePayments(card, payments, allCards);
  const linkedCards = allCards.filter((candidate) => candidate.id !== card.id && getLinkedCardIds(candidate, allCards).includes(card.id!));
  const sharedLimit = Math.max(card.totalLimit, ...linkedCards.map((candidate) => candidate.totalLimit));
  const sharedWaiveOffLimit = Math.max(
    card.waiveOffLimit ?? 0,
    ...linkedCards.map((candidate) => candidate.waiveOffLimit ?? 0),
  );

  const totalSpent = scopeExpenses.reduce((sum, exp) => {
    if (!exp.isEmi) return sum + exp.amount;
    return sum + calcEmiTotalCost(
      exp.amount,
      exp.emiInterestRate ?? 0,
      exp.emiMonths ?? 1,
      exp.emiProcessingFee ?? 0,
      exp.emiGst ?? 0,
    );
  }, 0);

  const totalPaid = scopePayments.reduce((sum, p) => sum + p.amount, 0);

  if (!isCreditAccount) {
    const balance = Math.max(0, card.totalLimit - totalSpent + totalPaid);
    return {
      nextBillDate: today,
      lastBillDate: today,
      nextPayDate: today,
      totalSpent,
      totalPaid,
      currentCycleExpenses: [],
      amountToPayNext: 0,
      availableLimit: balance,
      currentBalance: balance,
      amcMessageText: null,
      remainingToWaive: 0,
      isAmcWaived: false,
    };
  }

  // Calculate next and last billing dates
  const nextBillDate = new Date(today.getFullYear(), today.getMonth(), card.billingDate ?? today.getDate());
  const lastBillDate = new Date(today.getFullYear(), today.getMonth(), card.billingDate ?? today.getDate());

  if (today > nextBillDate) {
    nextBillDate.setMonth(nextBillDate.getMonth() + 1);
  } else {
    lastBillDate.setMonth(lastBillDate.getMonth() - 1);
  }

  const nextPayDate = new Date(today.getFullYear(), today.getMonth(), card.paymentDate ?? today.getDate());
  if (today > nextPayDate || nextPayDate <= nextBillDate) {
    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
  }

  // Build amountToPayNext cycle-aware for EMI:
  // - Non-EMI: include if expense date falls within [lastBillDate, nextBillDate)
  // - EMI: include 1 installment (+ proportional GST) if this billing cycle is within the active EMI window
  let amountToPayNext = 0;
  const currentCycleExpenses: Expense[] = [];

  for (const exp of scopeExpenses) {
    if (!exp.isEmi) {
      const expDate = new Date(exp.date);
      if (expDate >= lastBillDate && expDate < nextBillDate) {
        amountToPayNext += exp.amount;
        currentCycleExpenses.push(exp);
      }
    } else {
      // Determine which "installment month" this billing cycle corresponds to
      const emiStart = new Date(exp.date);
      const monthIndex = monthsBetween(emiStart, lastBillDate);
      const months = exp.emiMonths ?? 1;
      if (monthIndex >= 0 && monthIndex < months) {
        const monthlyEmi = calcMonthlyEmi(exp.amount, exp.emiInterestRate ?? 0, months);
        const monthlyProcessingFee = (exp.emiProcessingFee ?? 0) / months;
        const monthlyGst = (exp.emiGst ?? 0) / months;
        amountToPayNext += monthlyEmi + monthlyProcessingFee + monthlyGst;
        currentCycleExpenses.push(exp);
      }
    }
  }

  const availableLimit = Math.max(0, sharedLimit - totalSpent + totalPaid);
  const currentBalance = sharedLimit - totalSpent + totalPaid;

  // AMC Waiver logic
  let amcMessageText = null;
  let remainingToWaive = 0;
  let isAmcWaived = false;

  if ((card.amc ?? 0) > 0 && sharedWaiveOffLimit > 0) {
    remainingToWaive = Math.max(0, sharedWaiveOffLimit - totalSpent);
    if (remainingToWaive > 0) {
      amcMessageText = `Spend ₹${remainingToWaive.toLocaleString("en-IN", {minimumFractionDigits: 2,maximumFractionDigits: 2})} more to waive AMC`;
    } else {
      amcMessageText = "AMC Waived! 🎉";
      isAmcWaived = true;
    }
  }

  return {
    nextBillDate,
    lastBillDate,
    nextPayDate,
    totalSpent,
    totalPaid,
    currentCycleExpenses,
    amountToPayNext,
    availableLimit,
    currentBalance,
    limit: sharedLimit,
    amcMessageText,
    remainingToWaive,
    isAmcWaived
  };
}

export function getAccountAlertStatus(card: Card, metrics: ReturnType<typeof getCardMetrics>): AccountAlertStatus | null {
  const spendingLimit = metrics.limit ?? card.totalLimit;
  const spentRatio = spendingLimit > 0 ? metrics.currentBalance / spendingLimit : 0;
  const isLowBalance = card.type !== 'credit' && metrics.currentBalance <= Math.max(1000, spendingLimit * 0.1);
  const isOverLimit = card.type === 'credit' && metrics.availableLimit <= 0;

  if (isOverLimit) {
    return {
      severity: 'danger',
      message: `${card.title} is over its limit`,
      detail: `Available limit is ₹${metrics.availableLimit.toLocaleString('en-IN')} after current spend.`,
    };
  }

  if (isLowBalance) {
    return {
      severity: 'warning',
      message: `${card.title} balance is running low`,
      detail: `Current balance is ₹${metrics.currentBalance.toLocaleString('en-IN')}.`,
    };
  }

  if (card.type === 'credit' && spentRatio <= 0.8 && metrics.availableLimit > 0) {
    return null;
  }

  if (card.type === 'credit' && spentRatio <= 0.9) {
    return {
      severity: 'warning',
      message: `${card.title} is nearing its credit limit`,
      detail: `Only ₹${metrics.availableLimit.toLocaleString('en-IN')} of limit remains.`,
    };
  }

  return null;
}
