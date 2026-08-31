import { Gift, Info } from "lucide-react";
import { type CarryoverCalculation } from "../services/budget-carryover.service";
interface BudgetCarryoverPanelProps {
  readonly carryovers: readonly CarryoverCalculation[];
  readonly title?: string;
}
export default function BudgetCarryoverPanel({
  carryovers,
  title = "Budget Carryover",
}: BudgetCarryoverPanelProps) {
  const activeCarryovers = carryovers.filter((c) => c.actualCarryover > 0);
  const totalCarryover = activeCarryovers.reduce((sum, c) => sum + c.actualCarryover, 0);
  if (activeCarryovers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        {" "}
        <div className="flex items-center gap-2 mb-4">
          {" "}
          <Gift className="w-5 h-5 text-purple-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>{" "}
        </div>{" "}
        <p className="text-slate-400">
          {" "}
          No carryover available. All categories fully spent or carryover not enabled.{" "}
        </p>{" "}
      </div>
    );
  }
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <Gift className="w-5 h-5 text-purple-400" />{" "}
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>{" "}
        </div>{" "}
        {totalCarryover > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-purple-400/10 border border-purple-400/30 rounded-lg">
            {" "}
            <span className="text-sm font-medium text-purple-400">
              {" "}
              ₹{" "}
              {totalCarryover.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              Available{" "}
            </span>{" "}
          </div>
        )}{" "}
      </div>{" "}
      <div className="bg-purple-400/10 border border-purple-400/30 rounded-lg p-4 mb-4">
        {" "}
        <div className="flex gap-3">
          {" "}
          <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />{" "}
          <div className="text-xs text-purple-300">
            {" "}
            <p className="font-medium mb-1">How Carryover Works</p>{" "}
            <p>
              {" "}
              Unused budget from last month is carried forward and added to this month's budget,
              giving you more flexibility. Each category has a carryover limit to prevent excessive
              accumulation.{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="space-y-3">
        {" "}
        {activeCarryovers.map((carryover) => (
          <div
            key={carryover.categoryId}
            className="bg-slate-800/50 p-4 rounded-lg border border-purple-400/20"
          >
            {" "}
            <div className="flex items-start justify-between mb-2">
              {" "}
              <h3 className="font-medium text-slate-200"> {carryover.categoryTitle} </h3>{" "}
              <span className="text-sm font-semibold px-2 py-1 bg-purple-400/20 text-purple-400 rounded">
                {" "}
                +₹{" "}
                {carryover.actualCarryover.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
              </span>{" "}
            </div>{" "}
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              {" "}
              <div>
                {" "}
                <p className="text-slate-400">Previous Budget</p>{" "}
                <p className="text-slate-200 font-medium">
                  {" "}
                  ₹{" "}
                  {carryover.previousMonthBudget.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
              <div>
                {" "}
                <p className="text-slate-400">Spent</p>{" "}
                <p className="text-slate-200 font-medium">
                  {" "}
                  ₹{" "}
                  {carryover.previousMonthSpent.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="bg-slate-700/50 h-1 rounded-full mb-2 overflow-hidden">
              {" "}
              <div
                className="h-full bg-purple-500"
                style={{
                  width: `${(carryover.previousMonthSpent / carryover.previousMonthBudget) * 100}%`,
                }}
              />{" "}
            </div>{" "}
            <div className="grid grid-cols-2 gap-2 p-2 bg-slate-700/30 rounded">
              {" "}
              <div>
                {" "}
                <p className="text-xs text-slate-400">This Month Budget</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {carryover.currentMonthEffectiveBudget.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
              <div>
                {" "}
                <p className="text-xs text-slate-400">Carryover Limit</p>{" "}
                <p className="text-sm font-semibold text-slate-200">
                  {" "}
                  ₹{" "}
                  {carryover.carryoverLimit?.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      <div className="pt-3 border-t border-slate-700">
        {" "}
        <p className="text-xs text-slate-400">
          {" "}
          🎁 <span className="text-slate-300">Total available carryover:</span> ₹{" "}
          {totalCarryover.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
