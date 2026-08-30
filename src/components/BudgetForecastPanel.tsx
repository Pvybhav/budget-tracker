import { TrendingUp, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { type BudgetForecast } from "../services/budget-forecast.service";
interface BudgetForecastPanelProps {
  readonly forecasts: readonly BudgetForecast[];
  readonly title?: string;
}
export default function BudgetForecastPanel({
  forecasts,
  title = "Budget Forecast",
}: BudgetForecastPanelProps) {
  if (forecasts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        {" "}
        <div className="flex items-center gap-2 mb-4">
          {" "}
          <TrendingUp className="w-5 h-5 text-cyan-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>{" "}
        </div>{" "}
        <p className="text-slate-400">
          {" "}
          No categories with budgets. Set a budget to see forecasts.{" "}
        </p>{" "}
      </div>
    );
  }
  const dangerousForecastsCount = forecasts.filter((f) => f.riskLevel !== "safe").length;
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <TrendingUp className="w-5 h-5 text-cyan-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>{" "}
        </div>{" "}
        {dangerousForecastsCount > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-red-400/10 border border-red-400/30 rounded-lg">
            {" "}
            <AlertCircle className="w-4 h-4 text-red-400" />{" "}
            <span className="text-sm font-medium text-red-400">
              {" "}
              {dangerousForecastsCount} at risk{" "}
            </span>{" "}
          </div>
        )}{" "}
      </div>{" "}
      <div className="space-y-3">
        {" "}
        {forecasts.map((forecast) => (
          <div
            key={forecast.categoryId}
            className={`p-4 border rounded-xl transition-colors ${forecast.riskLevel === "danger" ? "bg-red-400/5 border-red-400/30" : forecast.riskLevel === "warning" ? "bg-amber-400/5 border-amber-400/30" : "bg-emerald-400/5 border-emerald-400/30"}`}
          >
            {" "}
            <div className="flex items-start justify-between mb-2">
              {" "}
              <div className="flex items-center gap-2">
                {" "}
                {forecast.riskLevel === "danger" && (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}{" "}
                {forecast.riskLevel === "warning" && (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}{" "}
                {forecast.riskLevel === "safe" && (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}{" "}
                <h3 className="font-medium text-slate-200"> {forecast.categoryTitle} </h3>{" "}
              </div>{" "}
              <span
                className={`text-sm font-semibold px-2 py-1 rounded ${forecast.riskLevel === "danger" ? "bg-red-400/20 text-red-300" : forecast.riskLevel === "warning" ? "bg-amber-400/20 text-amber-300" : "bg-emerald-400/20 text-emerald-300"}`}
              >
                {" "}
                {forecast.forecastPercentage.toFixed(0)}%{" "}
              </span>{" "}
            </div>{" "}
            <p
              className={`text-sm mb-3 ${forecast.riskLevel === "danger" ? "text-red-300" : forecast.riskLevel === "warning" ? "text-amber-300" : "text-emerald-300"}`}
            >
              {" "}
              {forecast.riskMessage}{" "}
            </p>{" "}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {" "}
              <div className="bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-400 mb-1">Current Spent</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {forecast.currentSpent.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
              <div className="bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-400 mb-1">Budget Limit</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {forecast.effectiveBudget.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {" "}
              <div className="bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-400 mb-1">Daily Pace</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {forecast.dailyPace.averageDaily.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
                <p className="text-xs text-slate-500 mt-1">
                  {" "}
                  ({forecast.dailyPace.daysElapsed} of{" "}
                  {forecast.dailyPace.daysElapsed + forecast.dailyPace.daysRemaining} days){" "}
                </p>{" "}
              </div>{" "}
              <div className="bg-slate-800/50 p-3 rounded-lg">
                {" "}
                <p className="text-xs text-slate-400 mb-1">Projected Spend</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {forecast.projectedSpent.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
                <p
                  className={`text-xs mt-1 ${forecast.willExceed ? "text-red-400" : "text-emerald-400"}`}
                >
                  {" "}
                  {forecast.projectedRemaining >= 0
                    ? `₹${forecast.projectedRemaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining`
                    : `₹${forecast.exceedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over`}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            {/* Progress bar */}{" "}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              {" "}
              <div
                className={`h-full transition-all ${forecast.riskLevel === "danger" ? "bg-red-500" : forecast.riskLevel === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, forecast.forecastPercentage)}%` }}
              />{" "}
            </div>{" "}
            <p className="text-xs text-slate-400 mt-2">
              {" "}
              At current pace, you'll spend{" "}
              <span className="text-slate-200 font-semibold">
                {" "}
                ₹{" "}
                {forecast.projectedSpent.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
              </span>{" "}
              by end of period.{" "}
              {forecast.dailyPace.daysRemaining > 0 && (
                <>
                  {" "}
                  With {forecast.dailyPace.daysRemaining} days left, consider reducing daily
                  spending to{" "}
                  <span className="text-slate-200 font-semibold">
                    {" "}
                    ₹{" "}
                    {(
                      forecast.projectedRemaining / forecast.dailyPace.daysRemaining
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                  </span>{" "}
                  per day.{" "}
                </>
              )}{" "}
            </p>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      {forecasts.length > 0 && (
        <div className="pt-3 border-t border-slate-700">
          {" "}
          <p className="text-xs text-slate-400">
            {" "}
            💡 <span className="text-slate-300">Tip:</span> Forecasts are based on current spending
            pace. Actual results may vary based on future spending patterns.{" "}
          </p>{" "}
        </div>
      )}{" "}
    </div>
  );
}
