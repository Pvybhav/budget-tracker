import { type Category } from "../db/db";
export interface CategoryWithCarryover extends Category {
  readonly carryoverAmount?: number;
  readonly carryoverFromMonth?: string;
  readonly maxCarryoverLimit?: number;
  readonly enableCarryover?: boolean;
}
export interface CarryoverCalculation {
  categoryId?: number;
  categoryTitle?: string;
  previousMonthBudget: number;
  previousMonthSpent: number;
  carryoverAmount: number;
  carryoverLimit?: number;
  actualCarryover: number;
  currentMonthEffectiveBudget: number;
  note: string;
}
export function calculateMonthlyCarryover(
  category: CategoryWithCarryover,
  previousMonthSpent: number,
): CarryoverCalculation {
  if (!category.budgetAmount || !category.budgetMode || !category.enableCarryover) {
    return {
      categoryId: category.id,
      categoryTitle: category.title,
      previousMonthBudget: 0,
      previousMonthSpent,
      carryoverAmount: 0,
      actualCarryover: 0,
      currentMonthEffectiveBudget: category.budgetAmount ? category.budgetAmount / 12 : 0,
      note: "Carryover not enabled for this category",
    };
  }
  const monthlyBudget = category.budgetAmount / 12;
  const unused = Math.max(0, monthlyBudget - previousMonthSpent);
  const maxLimit = category.maxCarryoverLimit ?? monthlyBudget; // Default: can carry over 1 full month
  const actualCarryover = Math.min(unused, maxLimit);
  const currentMonthEffectiveBudget = monthlyBudget + actualCarryover;
  return {
    categoryId: category.id,
    categoryTitle: category.title,
    previousMonthBudget: monthlyBudget,
    previousMonthSpent,
    carryoverAmount: unused,
    carryoverLimit: maxLimit,
    actualCarryover,
    currentMonthEffectiveBudget,
    note: `Carrying over ₹${actualCarryover.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from last month. Effective budget: ₹${currentMonthEffectiveBudget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}
export function calculateCategoryCarryovers(
  categoriesWithCarryover: CategoryWithCarryover[],
  previousMonthSpentByCategory: Map<number, number>,
): CarryoverCalculation[] {
  return categoriesWithCarryover
    .map((cat) => {
      const spent = previousMonthSpentByCategory.get(cat.id!) ?? 0;
      return calculateMonthlyCarryover(cat, spent);
    })
    .filter((calc) => calc.actualCarryover > 0 || calc.categoryTitle);
}
export function getEffectiveBudgetWithCarryover(baseBudget: number, carryover: number): number {
  return baseBudget + carryover;
}
