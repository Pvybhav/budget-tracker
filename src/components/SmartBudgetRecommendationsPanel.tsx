import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Minus, Zap } from "lucide-react";
import { type BudgetRecommendation } from "../services/budget-recommendations.service";
import { formatMoney, useDisplayCurrency } from "../services/currency.service";
interface SmartBudgetRecommendationsPanelProps {
  readonly recommendations: readonly BudgetRecommendation[];
  readonly title?: string;
}
export default function SmartBudgetRecommendationsPanel({
  recommendations,
  title = "Smart Budget Recommendations",
}: SmartBudgetRecommendationsPanelProps) {
  const displayCurrency = useDisplayCurrency();
  if (recommendations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
        {" "}
        <div className="flex items-center gap-2 mb-4">
          {" "}
          <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">{title}</h2>{" "}
        </div>{" "}
        <p className="text-slate-600 dark:text-slate-400">
          {" "}
          No categories with spending data. Add expenses to get recommendations.{" "}
        </p>{" "}
      </div>
    );
  }
  const totalSavings = recommendations.reduce((sum, rec) => sum + rec.savingsOpportunity, 0);
  const highRiskCount = recommendations.filter((r) => r.riskLevel === "high").length;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">{title}</h2>{" "}
        </div>{" "}
        {totalSavings > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-emerald-400/10 border border-emerald-400/30 rounded-lg">
            {" "}
            <TrendingDown className="w-4 h-4 text-emerald-400" />{" "}
            <span className="text-sm font-medium text-emerald-400">
              {" "}
              Save {formatMoney(totalSavings, displayCurrency)} /month{" "}
            </span>{" "}
          </div>
        )}{" "}
      </div>{" "}
      <div className="space-y-3">
        {" "}
        {recommendations.map((rec) => (
          <div
            key={rec.categoryId}
            className={`p-4 border rounded-xl transition-colors ${rec.riskLevel === "high" ? "bg-red-400/5 border-red-400/30" : rec.riskLevel === "medium" ? "bg-amber-400/5 border-amber-400/30" : "bg-emerald-400/5 border-emerald-400/30"}`}
          >
            {" "}
            <div className="flex items-start justify-between mb-2">
              {" "}
              <div className="flex items-center gap-2">
                {" "}
                {rec.riskLevel === "high" && (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}{" "}
                {rec.riskLevel === "medium" && <AlertTriangle className="w-4 h-4 text-amber-400" />}{" "}
                {rec.riskLevel === "low" && <CheckCircle className="w-4 h-4 text-emerald-400" />}{" "}
                <h3 className="font-medium text-slate-900 dark:text-slate-200">
                  {" "}
                  {rec.categoryTitle}{" "}
                </h3>{" "}
              </div>{" "}
            </div>{" "}
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{rec.reasoning}</p>{" "}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {" "}
              <div className="bg-slate-100 dark:bg-slate-800/50 p-2.5 rounded-lg">
                {" "}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Avg / month
                </p>{" "}
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                  {" "}
                  {formatMoney(rec.averageMonthlySpending, displayCurrency)}{" "}
                </p>{" "}
              </div>{" "}
              <div className="bg-slate-100 dark:bg-slate-800/50 p-2.5 rounded-lg">
                {" "}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Peak month
                </p>{" "}
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                  {" "}
                  {formatMoney(rec.maxMonthlySpending, displayCurrency)}{" "}
                </p>{" "}
              </div>{" "}
              <div className="bg-slate-100 dark:bg-slate-800/50 p-2.5 rounded-lg">
                {" "}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">Trend</p>{" "}
                <p className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-200 capitalize">
                  {" "}
                  {rec.trend === "increasing" && (
                    <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                  )}{" "}
                  {rec.trend === "decreasing" && (
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                  )}{" "}
                  {rec.trend === "stable" && <Minus className="w-3.5 h-3.5 text-slate-400" />}{" "}
                  {rec.trend}{" "}
                </p>{" "}
              </div>{" "}
              <div
                className={`p-2.5 rounded-lg ${rec.frequentlyExceeded ? "bg-red-400/10" : "bg-slate-100 dark:bg-slate-800/50"}`}
              >
                {" "}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Over budget
                </p>{" "}
                <p
                  className={`text-xs font-semibold ${rec.frequentlyExceeded ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-200"}`}
                >
                  {" "}
                  {rec.frequentlyExceeded
                    ? `${rec.overBudgetMonths}/${rec.monthsAnalyzed} months`
                    : "No frequent overruns"}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {" "}
              <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Current Budget
                </p>{" "}
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                  {" "}
                  {rec.currentBudget ? (
                    <>{formatMoney(rec.currentBudget, displayCurrency)}</>
                  ) : (
                    <span className="text-slate-500">Not set</span>
                  )}{" "}
                </p>{" "}
              </div>{" "}
              <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {" "}
                  Recommended Budget{" "}
                </p>{" "}
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {" "}
                  {formatMoney(rec.recommendedBudget, displayCurrency)}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            {rec.savingsOpportunity > 0 && (
              <div className="bg-emerald-400/10 border border-emerald-400/30 p-3 rounded-lg">
                {" "}
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                  {" "}
                  Potential Monthly Savings{" "}
                </p>{" "}
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {" "}
                  {formatMoney(rec.savingsOpportunity, displayCurrency)}{" "}
                </p>{" "}
              </div>
            )}{" "}
          </div>
        ))}{" "}
      </div>{" "}
      {highRiskCount > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          {" "}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {" "}
            ⚠️{" "}
            <span className="text-slate-700 dark:text-slate-300">
              {" "}
              {highRiskCount} categor{highRiskCount === 1 ? "y" : "ies"} need budget
              adjustment.{" "}
            </span>{" "}
          </p>{" "}
        </div>
      )}{" "}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        {" "}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {" "}
          💡 <span className="text-slate-700 dark:text-slate-300">Tip:</span> Recommendations use
          the last {recommendations[0]?.monthsAnalyzed ?? 6} months of spending. Review and adjust
          based on your financial goals.{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
