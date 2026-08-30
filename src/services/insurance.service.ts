import type { InsurancePolicy, PremiumFrequency } from "../db/db";
export type InsuranceStatus = "due" | "upcoming" | "ok" | "expired";
export interface InsurancePolicySummary {
  nextDueDate: string;
  daysUntilDue: number;
  status: InsuranceStatus;
  totalPaid: number;
}
function addFrequency(date: Date, frequency: PremiumFrequency): Date {
  const result = new Date(date);
  switch (frequency) {
    case "monthly":
      result.setMonth(result.getMonth() + 1);
      break;
    case "quarterly":
      result.setMonth(result.getMonth() + 3);
      break;
    case "half-yearly":
      result.setMonth(result.getMonth() + 6);
      break;
    case "yearly":
    default:
      result.setFullYear(result.getFullYear() + 1);
      break;
  }
  return result;
}
export function getInsurancePolicySummary(policy: InsurancePolicy): InsurancePolicySummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const payments = policy.premiumPayments ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const lastPaidDate = payments
    .map((p) => new Date(p.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  let nextDue = addFrequency(lastPaidDate ?? new Date(policy.startDate), policy.premiumFrequency);
  if (!lastPaidDate) {
    nextDue = new Date(policy.startDate);
  }
  const endDate = policy.endDate ? new Date(policy.endDate) : undefined;
  const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let status: InsuranceStatus = "ok";
  if (endDate && endDate < today) {
    status = "expired";
  } else if (daysUntilDue <= 0) {
    status = "due";
  } else if (daysUntilDue <= 15) {
    status = "upcoming";
  }
  return { nextDueDate: nextDue.toISOString().slice(0, 10), daysUntilDue, status, totalPaid };
}
