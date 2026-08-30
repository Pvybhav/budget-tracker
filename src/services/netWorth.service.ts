import type { Card, Loan } from "../db/db";
import { getEmiSchedule } from "./card.service";
export function getLoanRemainingBalance(loan: Loan): number {
  const schedule = getEmiSchedule(
    loan.principal,
    loan.annualInterestRate,
    loan.termMonths,
    loan.startDate,
  );
  const paidPaymentNumbers = new Set(
    (loan.repayments ?? [])
      .filter((repayment) => repayment.paid)
      .map((repayment) => repayment.paymentNumber),
  );
  const paidPrincipal = schedule.reduce(
    (total, row) =>
      paidPaymentNumbers.has(row.paymentNumber) ? total + row.principalAmount : total,
    0,
  );
  return Math.max(0, loan.principal - paidPrincipal);
}
export function getAccountTypeLabel(card: Card): string {
  switch (card.type) {
    case "credit":
      return "Credit cards";
    case "debit":
      return "Debit cards";
    case "bank":
      return "Bank accounts";
    case "meal":
      return "Meal cards";
    case "wallet":
      return "Wallets";
    case "cash":
      return "Cash";
    case "gift":
      return "Gift cards";
    default:
      return "Other accounts";
  }
}
