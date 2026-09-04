import { Calendar, ChevronRight } from "lucide-react";
import {
  getCustomPeriodLabel,
  getDaysElapsedInPeriod,
  getDaysRemainingInPeriod,
  getPercentPeriodElapsed,
} from "../services/budget-periods.service";
interface CustomBudgetPeriodsDisplayProps {
  readonly selectedStartDate: number;
  readonly title?: string;
}
export default function CustomBudgetPeriodsDisplay({
  selectedStartDate,
  title = "Budget Period",
}: CustomBudgetPeriodsDisplayProps) {
  const periodLabel = getCustomPeriodLabel(selectedStartDate);
  const daysElapsed = getDaysElapsedInPeriod(selectedStartDate);
  const daysRemaining = getDaysRemainingInPeriod(selectedStartDate);
  const percentElapsed = getPercentPeriodElapsed(selectedStartDate);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
      {" "}
      <div className="flex items-center gap-2">
        {" "}
        <Calendar className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />{" "}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">{title}</h2>{" "}
      </div>{" "}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
        {" "}
        <div className="flex items-center justify-between mb-4">
          {" "}
          <div>
            {" "}
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              Current Budget Period
            </p>{" "}
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{periodLabel}</p>{" "}
            {selectedStartDate !== 1 && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {" "}
                Runs from {selectedStartDate}th of each month to {selectedStartDate - 1}th of next
                month{" "}
              </p>
            )}{" "}
          </div>{" "}
        </div>{" "}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {" "}
          <div className="bg-white dark:bg-slate-700/50 p-3 rounded">
            {" "}
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Days Elapsed</p>{" "}
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-200">
              {" "}
              {daysElapsed}{" "}
            </p>{" "}
          </div>{" "}
          <div className="bg-white dark:bg-slate-700/50 p-3 rounded">
            {" "}
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Days Remaining</p>{" "}
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-200">
              {" "}
              {daysRemaining}{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
        {/* Progress bar */}{" "}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          {" "}
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, percentElapsed)}%` }}
          />{" "}
        </div>{" "}
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-right">
          {" "}
          {percentElapsed.toFixed(0)}% through period{" "}
        </p>{" "}
      </div>{" "}
      <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-4">
        {" "}
        <div className="flex gap-3">
          {" "}
          <ChevronRight className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />{" "}
          <div className="text-xs text-blue-700 dark:text-blue-300">
            {" "}
            <p className="font-medium mb-1">Custom Budget Periods</p>{" "}
            <p>
              {" "}
              {selectedStartDate === 1
                ? "Using calendar month (1st to last day). You can customize this to match your salary cycle."
                : `Your budget period starts on the ${selectedStartDate}th of each month, aligning with your salary date.`}{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
