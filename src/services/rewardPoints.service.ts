import type { RewardPointsEntry } from "../db/db";
export interface RewardPointsSummary {
  balance: number;
  totalValue: number;
  nextExpiry?: string;
}
export function getRewardPointsSummary(entries: RewardPointsEntry[]): RewardPointsSummary {
  let balance = 0;
  let totalValue = 0;
  let nextExpiry: string | undefined;
  const today = new Date();
  for (const entry of entries) {
    if (entry.type === "earned") {
      balance += entry.points;
      totalValue += entry.points * (entry.valuePerPoint ?? 0);
      if (entry.expiryDate) {
        const expiry = new Date(entry.expiryDate);
        if (expiry >= today && (!nextExpiry || entry.expiryDate < nextExpiry)) {
          nextExpiry = entry.expiryDate;
        }
      }
    } else {
      balance -= entry.points;
      totalValue -= entry.points * (entry.valuePerPoint ?? 0);
    }
  }
  return { balance: Math.max(0, balance), totalValue: Math.max(0, totalValue), nextExpiry };
}
