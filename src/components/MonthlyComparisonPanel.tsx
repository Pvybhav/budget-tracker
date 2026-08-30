import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { type MonthlyTrendComparison } from "../services/budget-comparison.service";
interface MonthlyComparisonPanelProps {
  readonly comparison: MonthlyTrendComparison;
  readonly title?: string;
}
export default function MonthlyComparisonPanel({
  comparison,
  title = "Monthly Comparison",
}: MonthlyComparisonPanelProps) {
  const totalChange = comparison.totalChangePercent;
  const isIncrease = totalChange > 0;
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <Calendar className="w-5 h-5 text-cyan-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>{" "}
        </div>{" "}
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-lg border ${isIncrease ? "bg-red-400/10 border-red-400/30 text-red-400" : "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"}`}
        >
          {" "}
          {isIncrease ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}{" "}
          <span className="text-sm font-medium"> {Math.abs(totalChange).toFixed(1)}% </span>{" "}
        </div>{" "}
      </div>{" "}
      {/* Overall spending comparison */}{" "}
      <div className="grid grid-cols-3 gap-3">
        {" "}
        <div className="bg-slate-800/50 p-4 rounded-lg">
          {" "}
          <p className="text-xs text-slate-400 mb-1"> {comparison.currentMonth.month} </p>{" "}
          <p className="text-lg font-semibold text-slate-200">
            {" "}
            ₹{" "}
            {comparison.currentMonth.totalSpending.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}{" "}
          </p>{" "}
        </div>{" "}
        <div className="bg-slate-800/50 p-4 rounded-lg">
          {" "}
          <p className="text-xs text-slate-400 mb-1"> {comparison.previousMonth.month} </p>{" "}
          <p className="text-lg font-semibold text-slate-200">
            {" "}
            ₹{" "}
            {comparison.previousMonth.totalSpending.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}{" "}
          </p>{" "}
        </div>{" "}
        <div className="bg-slate-800/50 p-4 rounded-lg">
          {" "}
          <p className="text-xs text-slate-400 mb-1"> {comparison.twoMonthsAgo.month} </p>{" "}
          <p className="text-lg font-semibold text-slate-200">
            {" "}
            ₹{" "}
            {comparison.twoMonthsAgo.totalSpending.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}{" "}
          </p>{" "}
        </div>{" "}
      </div>{" "}
      {/* Highlights */}{" "}
      <div className="grid grid-cols-2 gap-3">
        {" "}
        {comparison.highestIncreaseCategory && (
          <div className="bg-red-400/5 border border-red-400/30 p-4 rounded-lg">
            {" "}
            <div className="flex items-center gap-2 mb-2">
              {" "}
              <TrendingUp className="w-4 h-4 text-red-400" />{" "}
              <p className="text-xs text-red-400 font-medium"> Highest Increase </p>{" "}
            </div>{" "}
            <p className="text-sm font-semibold text-slate-200 mb-1">
              {" "}
              {comparison.highestIncreaseCategory.categoryTitle}{" "}
            </p>{" "}
            <p className="text-xs text-red-400">
              {" "}
              +{comparison.highestIncreaseCategory.percentChange.toFixed(1)}% (₹{" "}
              {(
                comparison.highestIncreaseCategory.currentMonthSpending -
                comparison.highestIncreaseCategory.previousMonthSpending
              ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}{" "}
              ){" "}
            </p>{" "}
          </div>
        )}{" "}
        {comparison.highestDecreaseCategory && (
          <div className="bg-emerald-400/5 border border-emerald-400/30 p-4 rounded-lg">
            {" "}
            <div className="flex items-center gap-2 mb-2">
              {" "}
              <TrendingDown className="w-4 h-4 text-emerald-400" />{" "}
              <p className="text-xs text-emerald-400 font-medium"> Highest Decrease </p>{" "}
            </div>{" "}
            <p className="text-sm font-semibold text-slate-200 mb-1">
              {" "}
              {comparison.highestDecreaseCategory.categoryTitle}{" "}
            </p>{" "}
            <p className="text-xs text-emerald-400">
              {" "}
              {comparison.highestDecreaseCategory.percentChange.toFixed(1)}% (₹{" "}
              {(
                comparison.highestDecreaseCategory.currentMonthSpending -
                comparison.highestDecreaseCategory.previousMonthSpending
              ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}{" "}
              ){" "}
            </p>{" "}
          </div>
        )}{" "}
      </div>{" "}
      {/* Category breakdown */}{" "}
      {comparison.categoryComparisons.length > 0 && (
        <div className="space-y-2">
          {" "}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {" "}
            Category Breakdown{" "}
          </p>{" "}
          <div className="space-y-2">
            {" "}
            {comparison.categoryComparisons.slice(0, 5).map((cat) => (
              <div
                key={cat.categoryId}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg"
              >
                {" "}
                <div className="flex items-center gap-2 flex-1">
                  {" "}
                  {cat.trend === "increased" && (
                    <TrendingUp className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  )}{" "}
                  {cat.trend === "decreased" && (
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  )}{" "}
                  {cat.trend === "stable" && (
                    <Minus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}{" "}
                  <div>
                    {" "}
                    <p className="text-sm text-slate-200"> {cat.categoryTitle} </p>{" "}
                    <p className="text-xs text-slate-400">
                      {" "}
                      ₹{" "}
                      {cat.currentMonthSpending.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      (was ₹{" "}
                      {cat.previousMonthSpending.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      ){" "}
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <div
                  className={`text-xs font-semibold px-2 py-1 rounded ${cat.percentChange > 0 ? "bg-red-400/20 text-red-400" : cat.percentChange < 0 ? "bg-emerald-400/20 text-emerald-400" : "bg-slate-600/20 text-slate-400"}`}
                >
                  {" "}
                  {cat.percentChange > 0 ? "+" : ""} {cat.percentChange.toFixed(1)}%{" "}
                </div>{" "}
              </div>
            ))}{" "}
          </div>{" "}
        </div>
      )}{" "}
      <div className="pt-3 border-t border-slate-700">
        {" "}
        <p className="text-xs text-slate-400">
          {" "}
          📊 <span className="text-slate-300">Tip:</span> Review spending patterns to identify areas
          for optimization.{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
