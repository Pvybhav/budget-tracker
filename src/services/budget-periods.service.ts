export interface CustomBudgetPeriod {
  readonly id?: string;
  readonly startDate: number; // Day of month (1-31)
  readonly periodName: string;
  readonly description?: string;
}
export interface BudgetPeriodRange {
  readonly start: Date;
  readonly end: Date;
  readonly startDay: number;
  readonly endDay: number;
  readonly daysInPeriod: number;
}
export function getBudgetPeriodRange(
  startDate: number,
  year: number,
  month: number,
): BudgetPeriodRange {
  // Clamp start date to valid day of month
  const maxDays = new Date(year, month + 1, 0).getDate();
  const actualStartDate = Math.min(startDate, maxDays); // Calculate period start
  let periodStart = new Date(year, month, actualStartDate);
  if (actualStartDate > new Date(year, month, 1).getDate()) {
    // Start date is past current month, so start from previous month
    periodStart = new Date(year, month - 1, actualStartDate);
    if (month === 0) {
      periodStart = new Date(year - 1, 11, actualStartDate);
    }
  } // Calculate period end (day before next period starts)
  let periodEnd = new Date(year, month + 1, actualStartDate - 1);
  if (month === 11) {
    periodEnd = new Date(year + 1, 0, actualStartDate - 1);
  }
  const daysInPeriod =
    Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return {
    start: periodStart,
    end: periodEnd,
    startDay: actualStartDate,
    endDay: periodEnd.getDate(),
    daysInPeriod,
  };
}
export function getCurrentBudgetPeriod(startDate: number): BudgetPeriodRange {
  const now = new Date();
  return getBudgetPeriodRange(startDate, now.getFullYear(), now.getMonth());
}
export function getPreviousBudgetPeriod(startDate: number): BudgetPeriodRange {
  const now = new Date();
  let prevMonth = now.getMonth() - 1;
  let prevYear = now.getFullYear();
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  return getBudgetPeriodRange(startDate, prevYear, prevMonth);
}
export function getDaysElapsedInPeriod(startDate: number): number {
  const now = new Date();
  const period = getCurrentBudgetPeriod(startDate);
  return Math.floor((now.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
export function getDaysRemainingInPeriod(startDate: number): number {
  const now = new Date();
  const period = getCurrentBudgetPeriod(startDate);
  return Math.max(0, Math.floor((period.end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
export function getPercentPeriodElapsed(startDate: number): number {
  const period = getCurrentBudgetPeriod(startDate);
  const daysElapsed = getDaysElapsedInPeriod(startDate);
  return (daysElapsed / period.daysInPeriod) * 100;
}
export const DEFAULT_BUDGET_PERIODS: readonly CustomBudgetPeriod[] = [
  {
    id: "calendar",
    startDate: 1,
    periodName: "Calendar Month",
    description: "Budget runs from 1st to last day of month",
  },
  {
    id: "salary-20",
    startDate: 20,
    periodName: "Salary (20th)",
    description: "Budget runs from 20th of month to 19th of next month",
  },
  {
    id: "salary-15",
    startDate: 15,
    periodName: "Salary (15th)",
    description: "Budget runs from 15th of month to 14th of next month",
  },
  {
    id: "salary-25",
    startDate: 25,
    periodName: "Salary (25th)",
    description: "Budget runs from 25th of month to 24th of next month",
  },
];
export function getCustomPeriodLabel(startDate: number): string {
  const predefined = DEFAULT_BUDGET_PERIODS.find((p) => p.startDate === startDate);
  if (predefined) return predefined.periodName;
  if (startDate === 1) return "Calendar Month";
  return `Custom (${startDate}th)`;
}
