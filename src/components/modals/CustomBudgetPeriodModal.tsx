import { useState } from "react";
import { X, Calendar, AlertCircle } from "lucide-react";
import {
  getCustomPeriodLabel,
  DEFAULT_BUDGET_PERIODS,
  type CustomBudgetPeriod,
} from "../../services/budget-periods.service";
interface CustomBudgetPeriodModalProps {
  readonly isOpen: boolean;
  readonly currentStartDate: number;
  readonly onClose: () => void;
  readonly onSave: (startDate: number) => void;
}
export default function CustomBudgetPeriodModal({
  isOpen,
  currentStartDate,
  onClose,
  onSave,
}: CustomBudgetPeriodModalProps) {
  const [selectedStartDate, setSelectedStartDate] = useState(currentStartDate);
  const [customDate, setCustomDate] = useState<string>(currentStartDate.toString());
  const handleSave = () => {
    const dateNum = parseInt(customDate, 10);
    if (dateNum >= 1 && dateNum <= 31) {
      onSave(dateNum);
      onClose();
    }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end z-50">
      {" "}
      <div className="bg-white border border-slate-200 rounded-t-3xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {" "}
        <div className="flex items-center justify-between">
          {" "}
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {" "}
            Budget Period Settings{" "}
          </h2>{" "}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300"
          >
            {" "}
            <X className="w-6 h-6" />{" "}
          </button>{" "}
        </div>{" "}
        <div className="space-y-3">
          {" "}
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {" "}
            Choose Budget Period{" "}
          </label>{" "}
          {/* Predefined options */}{" "}
          <div className="grid grid-cols-2 gap-2">
            {" "}
            {DEFAULT_BUDGET_PERIODS.map((period: CustomBudgetPeriod) => (
              <button
                type="button"
                key={period.id}
                onClick={() => {
                  setSelectedStartDate(period.startDate);
                  setCustomDate(period.startDate.toString());
                }}
                className={`p-3 rounded-lg border transition-colors text-left ${selectedStartDate === period.startDate ? "bg-blue-500/20 border-blue-500 text-slate-900 dark:text-slate-100" : "bg-slate-100 dark:bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800"}`}
              >
                {" "}
                <p className="font-medium text-sm">{period.periodName}</p>{" "}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {" "}
                  {period.description}{" "}
                </p>{" "}
              </button>
            ))}{" "}
          </div>{" "}
          {/* Custom date input */}{" "}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {" "}
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              {" "}
              Custom Start Date{" "}
            </label>{" "}
            <div className="flex gap-2">
              {" "}
              <div className="flex-1 relative">
                {" "}
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />{" "}
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={customDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDate(val);
                    const num = parseInt(val, 10);
                    if (num >= 1 && num <= 31) {
                      setSelectedStartDate(num);
                    }
                  }}
                  placeholder="Enter day (1-31)"
                  className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />{" "}
              </div>{" "}
              <span className="text-slate-500 dark:text-slate-400 font-medium py-2">th</span>{" "}
            </div>{" "}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {" "}
              Your budget will run from the {customDate}th of each month to the{" "}
              {Math.max(0, parseInt(customDate, 10) - 1)}th of the next month.{" "}
            </p>{" "}
          </div>{" "}
          {/* Preview */}{" "}
          {selectedStartDate >= 1 && selectedStartDate <= 31 && (
            <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-3">
              {" "}
              <p className="text-sm text-blue-300">
                {" "}
                <span className="font-medium">Period:</span>{" "}
                {getCustomPeriodLabel(selectedStartDate)}{" "}
              </p>{" "}
            </div>
          )}{" "}
          {/* Info */}{" "}
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-3">
            {" "}
            <div className="flex gap-2">
              {" "}
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />{" "}
              <div className="text-xs text-amber-300">
                {" "}
                <p className="font-medium mb-1">Budget Period Notes</p>{" "}
                <ul className="list-disc list-inside space-y-1">
                  {" "}
                  <li>Budget cycles reset on the selected day each month</li>{" "}
                  <li>Forecasts and comparisons use this period</li>{" "}
                  <li>Changes apply to all categories</li>{" "}
                </ul>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          {" "}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg transition-colors"
          >
            {" "}
            Cancel{" "}
          </button>{" "}
          <button
            type="button"
            onClick={handleSave}
            disabled={parseInt(customDate, 10) < 1 || parseInt(customDate, 10) > 31}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {" "}
            Save Period{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
