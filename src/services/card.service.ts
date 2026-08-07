import { db, type Card, type Expense, type Payment } from '../db/db';

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
  if (annualRatePct === 0 || months === 0) return principal / months;
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

export function getCardMetrics(card: Card, expenses: Expense[], payments: Payment[]) {
  const today = new Date();
  const isCreditAccount = card.type === 'credit';

  const totalSpent = expenses.reduce((sum, exp) => {
    if (!exp.isEmi) return sum + exp.amount;
    return sum + calcEmiTotalCost(
      exp.amount,
      exp.emiInterestRate ?? 0,
      exp.emiMonths ?? 1,
      exp.emiProcessingFee ?? 0,
      exp.emiGst ?? 0,
    );
  }, 0);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

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
  let nextBillDate = new Date(today.getFullYear(), today.getMonth(), card.billingDate ?? today.getDate());
  let lastBillDate = new Date(today.getFullYear(), today.getMonth(), card.billingDate ?? today.getDate());

  if (today > nextBillDate) {
    nextBillDate.setMonth(nextBillDate.getMonth() + 1);
  } else {
    lastBillDate.setMonth(lastBillDate.getMonth() - 1);
  }

  let nextPayDate = new Date(today.getFullYear(), today.getMonth(), card.paymentDate ?? today.getDate());
  if (today > nextPayDate || nextPayDate <= nextBillDate) {
    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
  }

  // Build amountToPayNext cycle-aware for EMI:
  // - Non-EMI: include if expense date falls within [lastBillDate, nextBillDate)
  // - EMI: include 1 installment (+ proportional GST) if this billing cycle is within the active EMI window
  let amountToPayNext = 0;
  const currentCycleExpenses: Expense[] = [];

  for (const exp of expenses) {
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

  const availableLimit = Math.max(0, card.totalLimit - totalSpent + totalPaid);
  const currentBalance = card.totalLimit - totalSpent + totalPaid;

  // AMC Waiver logic
  let amcMessageText = null;
  let remainingToWaive = 0;
  let isAmcWaived = false;

  if ((card.amc ?? 0) > 0 && (card.waiveOffLimit ?? 0) > 0) {
    remainingToWaive = Math.max(0, (card.waiveOffLimit ?? 0) - totalSpent);
    if (remainingToWaive > 0) {
      amcMessageText = `Spend ₹${remainingToWaive} more to waive AMC`;
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
    amcMessageText,
    remainingToWaive,
    isAmcWaived
  };
}

export async function addCard(data: Card) {
  return await db.cards.add(data);
}

export async function updateCard(id: number, data: Partial<Card>) {
  return await db.cards.update(id, data);
}

export async function deleteCardCascade(card: Card) {
  if (!card.id) return;
  // Cascade delete expenses
  const expenses = await db.expenses.where('cardId').equals(card.id).toArray();
  for (const exp of expenses) {
    await db.expenses.delete(exp.id!);
  }
  
  // Cascade delete payments
  const payments = await db.payments.where('cardId').equals(card.id).toArray();
  for (const pay of payments) {
    await db.payments.delete(pay.id!);
  }
  
  // Delete card
  await db.cards.delete(card.id);
}
