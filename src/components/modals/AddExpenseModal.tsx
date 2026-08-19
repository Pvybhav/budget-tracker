import { useState, useEffect } from "react";
import type { Expense } from "../../db/db";
import { useBackendResource } from "../../services/backendHooks";
import {
  fetchCards,
  fetchCategories,
  fetchExpenses,
} from "../../services/backend.service";
import {
  X,
  TrendingUp,
  TrendingDown,
  Tags,
  AlertTriangle,
  Info,
} from "lucide-react";
import { showAlert } from "../../components/Confirm";
import { useNavigate } from "react-router-dom";
import { calcMonthlyEmi } from "../../services/card.service";
import { getBudgetStatus } from "../../services/budget.service";
import { syncRecurringExpenses } from "../../services/recurring.service";
import { createExpense, updateExpense } from "../../services/backendSync";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExpense?: Expense;
}

const EMI_MONTH_OPTIONS = [2, 3, 6, 9, 12, 18, 24, 36, 48, 60];

const INTEREST_PRESETS = [
  { label: "No Cost EMI (0%)", value: 0 },
  { label: "9% p.a.", value: 9 },
  { label: "12% p.a.", value: 12 },
  { label: "13% p.a.", value: 13 },
  { label: "14% p.a.", value: 14 },
  { label: "15% p.a.", value: 15 },
  { label: "16% p.a.", value: 16 },
  { label: "18% p.a.", value: 18 },
  { label: "24% p.a.", value: 24 },
  { label: "Custom", value: -1 },
];

function fmt(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  initialExpense,
}: Props) {
  const navigate = useNavigate();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [formData, setFormData] = useState({
    cardId: "",
    categoryId: "",
    details: "",
    amount: "",
    date: new Date(
      new Date().getTime() - new Date().getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16),
    // EMI
    isEmi: false,
    emiMonths: 3,
    emiInterestPreset: 0, // value from INTEREST_PRESETS
    emiCustomInterest: "", // used when preset = -1 (Custom)
    emiProcessingFee: "",
    emiGst: "",
    isRecurring: false,
    recurringFrequency: "monthly" as Expense["recurringFrequency"],
    recurringInterval: 1,
    recurringEndDate: "",
  });

  const selectedCategory = categories?.find(
    (c) => c.id === parseInt(formData.categoryId),
  );

  const categoryMonthlySpent = useBackendResource(async () => {
    if (!selectedCategory?.id) return 0;
    const allExp = await fetchExpenses();
    const filtered = allExp.filter(
      (expense) => expense.categoryId === selectedCategory.id,
    );

    // For monthly-budget categories, EMI expenses contribute their monthly
    // installment (spread across each active month) rather than the full principal.
    // For daily/weekly budgets the full expense amount in the current month is used.
    const isMonthlyBudget = selectedCategory.budgetMode === "monthly";
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);

    const monthlyInstallmentOf = (e: (typeof filtered)[number]) => {
      const n = e.emiMonths ?? 1;
      return (
        calcMonthlyEmi(e.amount, e.emiInterestRate ?? 0, n) +
        (e.emiProcessingFee ?? 0) / n +
        (e.emiGst ?? 0) / n
      );
    };

    let spent = 0;
    for (const e of filtered) {
      if (isMonthlyBudget && e.isEmi) {
        // Count this installment if the EMI window covers the current month
        const emiStart = new Date(e.date);
        const monthIndex =
          (currentMonthStart.getFullYear() - emiStart.getFullYear()) * 12 +
          (currentMonthStart.getMonth() - emiStart.getMonth());
        if (monthIndex >= 0 && monthIndex < (e.emiMonths ?? 1)) {
          spent += monthlyInstallmentOf(e);
        }
      } else {
        // Non-EMI, or non-monthly budget: count full amount for current month only
        const d = new Date(e.date);
        if (
          d.getFullYear() === currentYear &&
          d.getMonth() + 1 === currentMonth
        ) {
          spent += e.amount;
        }
      }
    }

    // When editing an existing expense, subtract its current contribution so the
    // indicator shows the "before this edit" baseline.
    if (initialExpense?.categoryId === selectedCategory.id) {
      if (isMonthlyBudget && initialExpense.isEmi) {
        spent -= monthlyInstallmentOf(initialExpense);
      } else {
        const d = new Date(initialExpense.date);
        if (
          d.getFullYear() === currentYear &&
          d.getMonth() + 1 === currentMonth
        ) {
          spent -= initialExpense.amount;
        }
      }
    }

    return Math.max(0, spent);
  }, [
    selectedCategory?.id,
    selectedCategory?.budgetMode,
    currentYear,
    currentMonth,
    initialExpense?.id,
  ]);

  useEffect(() => {
    if (initialExpense) {
      const interestRate = initialExpense.emiInterestRate ?? 0;
      const presetExists = INTEREST_PRESETS.some(
        (p) => p.value === interestRate && p.value !== -1,
      );
      setFormData({
        cardId: initialExpense.cardId.toString(),
        categoryId: initialExpense.categoryId?.toString() ?? "",
        details: initialExpense.details ?? "",
        amount: initialExpense.amount.toString(),
        date: initialExpense.date,
        isEmi: initialExpense.isEmi ?? false,
        emiMonths: initialExpense.emiMonths ?? 3,
        emiInterestPreset: presetExists ? interestRate : -1,
        emiCustomInterest: presetExists ? "" : interestRate.toString(),
        emiProcessingFee: initialExpense.emiProcessingFee?.toString() ?? "",
        emiGst: initialExpense.emiGst?.toString() ?? "",
        isRecurring: Boolean(initialExpense.recurringFrequency),
        recurringFrequency: initialExpense.recurringFrequency ?? "monthly",
        recurringInterval: initialExpense.recurringInterval ?? 1,
        recurringEndDate: initialExpense.recurringEndDate ?? "",
      });
    } else {
      setFormData({
        cardId: "",
        categoryId: "",
        details: "",
        amount: "",
        date: new Date(
          new Date().getTime() - new Date().getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16),
        isEmi: false,
        emiMonths: 3,
        emiInterestPreset: 0,
        emiCustomInterest: "",
        emiProcessingFee: "",
        emiGst: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringInterval: 1,
        recurringEndDate: "",
      });
    }
  }, [initialExpense, isOpen]);

  if (!isOpen) return null;

  if (cards && cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            No Cards Found
          </h2>
          <p className="text-slate-400 mb-6">
            You need to add a credit card before logging an expense.
          </p>
          <button
            onClick={() => {
              onClose();
              navigate("/");
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard to Add Card
          </button>
        </div>
      </div>
    );
  }

  if (categories && categories.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Tags className="w-6 h-6 text-violet-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            No Categories Found
          </h2>
          <p className="text-slate-400 mb-6 text-sm">
            A category is required for every expense. Add at least one category
            before logging an expense.
          </p>
          <button
            onClick={() => {
              onClose();
              navigate("/categories");
            }}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Go to Manage Categories
          </button>
        </div>
      </div>
    );
  }

  // Derived EMI values
  const principal = parseFloat(formData.amount) || 0;
  const effectiveInterestRate =
    formData.emiInterestPreset === -1
      ? parseFloat(formData.emiCustomInterest) || 0
      : formData.emiInterestPreset;
  const processingFeeAmount = parseFloat(formData.emiProcessingFee) || 0;
  const gstAmount = parseFloat(formData.emiGst) || 0;
  const months = formData.emiMonths;

  const monthlyEmi =
    principal > 0 && months > 0
      ? calcMonthlyEmi(principal, effectiveInterestRate, months)
      : 0;
  const totalInterest =
    effectiveInterestRate > 0 ? monthlyEmi * months - principal : 0;
  const monthlyPayment =
    monthlyEmi + (processingFeeAmount + gstAmount) / months;
  const totalCost = principal + totalInterest + processingFeeAmount + gstAmount;
  // Credit limit blocked = full total cost (principal + interest + processing fee + GST)
  const availableLimitImpact = totalCost;

  const enteredBudgetImpact =
    selectedCategory?.budgetMode === "monthly" && formData.isEmi
      ? monthlyPayment
      : principal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cardId) {
      await showAlert("Please select a card");
      return;
    }
    if (!formData.categoryId) {
      await showAlert("Please select a category");
      return;
    }

    const payload: Omit<Expense, "id"> = {
      cardId: parseInt(formData.cardId),
      categoryId: parseInt(formData.categoryId),
      details: formData.details.trim() || undefined,
      amount: principal,
      date: formData.date,
      isEmi: formData.isEmi || undefined,
      emiMonths: formData.isEmi ? months : undefined,
      emiInterestRate: formData.isEmi ? effectiveInterestRate : undefined,
      emiProcessingFee:
        formData.isEmi && processingFeeAmount > 0
          ? processingFeeAmount
          : undefined,
      emiGst: formData.isEmi && gstAmount > 0 ? gstAmount : undefined,
      recurringFrequency: formData.isRecurring
        ? formData.recurringFrequency
        : undefined,
      recurringInterval: formData.isRecurring
        ? formData.recurringInterval
        : undefined,
      recurringEndDate: formData.isRecurring
        ? formData.recurringEndDate || undefined
        : undefined,
    };

    if (initialExpense) {
      await updateExpense(initialExpense.id!, payload);
    } else {
      await createExpense(payload);
    }
    await syncRecurringExpenses();
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]:
          name === "emiMonths" ||
          name === "emiInterestPreset" ||
          name === "recurringInterval"
            ? parseInt(value)
            : value,
      });
    }
  };

  // Budget indicator logic
  const spent = categoryMonthlySpent ?? 0;
  const hasBudget =
    selectedCategory?.budgetAmount != null &&
    selectedCategory?.budgetMode != null;
  const previewSpent = spent + enteredBudgetImpact;
  const budgetStatus = hasBudget
    ? getBudgetStatus(
        previewSpent,
        selectedCategory!.budgetAmount!,
        selectedCategory!.budgetMode!,
      )
    : null;
  const isOverBudget = budgetStatus?.isOverBudget ?? false;
  const isNearLimit = budgetStatus?.isNearLimit ?? false;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[92vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {initialExpense ? "Edit Expense" : "Log an Expense"}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {/* Card */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Select Card <span className="text-red-400">*</span>
            </label>
            <select
              required
              name="cardId"
              value={formData.cardId}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select a card...</option>
              {cards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              required
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select a category...</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          {/* Budget indicator */}
          {selectedCategory && hasBudget && budgetStatus && (
            <div
              className={`rounded-xl border px-4 py-3 flex items-center gap-4 ${isOverBudget ? "bg-red-500/10 border-red-500/30" : isNearLimit ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs uppercase tracking-wider font-medium text-slate-400">
                    {selectedCategory.budgetMode === "yearly"
                      ? "Yearly (≈monthly)"
                      : selectedCategory.budgetMode === "quarterly"
                        ? "Quarterly (≈monthly)"
                        : "Monthly"}{" "}
                    Budget · {selectedCategory.title}
                  </p>
                  <span
                    className={`text-xs font-semibold ${isOverBudget ? "text-red-400" : isNearLimit ? "text-amber-400" : "text-emerald-400"}`}
                  >
                    {budgetStatus.statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-xs text-slate-500">
                      Current spend
                    </span>
                    <p className="text-sm font-semibold text-slate-200">
                      ₹{fmt(spent)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-sky-400">New expense</span>
                    <p className="text-sm font-semibold text-sky-300">
                      ₹{fmt(enteredBudgetImpact)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Budget</span>
                    <p className="text-sm font-semibold text-slate-200">
                      ₹{fmt(budgetStatus.effectiveBudget)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Remaining</span>
                    <p
                      className={`text-sm font-bold flex items-center gap-1 ${isOverBudget ? "text-red-400" : isNearLimit ? "text-amber-400" : "text-emerald-400"}`}
                    >
                      {isOverBudget ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" />
                      )}
                      {isOverBudget ? "-" : "+"}₹
                      {fmt(Math.abs(budgetStatus.remaining))}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Usage</span>
                    <span>{budgetStatus.progressClamped}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className={`h-full shrink-0 transition-all ${isOverBudget ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-400"}`}
                        style={{
                          width: `${Math.min(100, budgetStatus.effectiveBudget > 0 ? (spent / budgetStatus.effectiveBudget) * 100 : 0)}%`,
                        }}
                      />
                      <div
                        className="h-full shrink-0 bg-sky-400 transition-all"
                        style={{
                          width: `${Math.min(100, budgetStatus.effectiveBudget > 0 ? (enteredBudgetImpact / budgetStatus.effectiveBudget) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Description{" "}
              <span className="text-slate-600 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              name="details"
              value={formData.details}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
              placeholder="e.g. Amazon Purchase"
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Amount <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* ── EMI SECTION ── */}
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            {/* Toggle header */}
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
              <input
                type="checkbox"
                name="isEmi"
                checked={formData.isEmi}
                onChange={handleChange}
                className="w-4 h-4 accent-amber-400"
              />
              <span className="font-medium text-slate-200 text-sm">
                Convert to EMI
              </span>
              {formData.isEmi && principal > 0 && (
                <span className="ml-auto text-xs text-amber-400 font-medium">
                  ₹{fmt(monthlyPayment)} / month
                </span>
              )}
            </label>

            {formData.isEmi && (
              <div className="p-4 space-y-4 border-t border-slate-700 bg-slate-800/20">
                {/* Duration + Interest */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Duration (months)
                    </label>
                    <select
                      name="emiMonths"
                      value={formData.emiMonths}
                      onChange={handleChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    >
                      {EMI_MONTH_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} months
                        </option>
                      ))}
                      {/* Allow any value 2-60 that isn't in presets */}
                      {!EMI_MONTH_OPTIONS.includes(formData.emiMonths) && (
                        <option value={formData.emiMonths}>
                          {formData.emiMonths} months
                        </option>
                      )}
                    </select>
                    {/* Custom month input */}
                    <input
                      type="number"
                      min="2"
                      max="60"
                      step="1"
                      placeholder="Or type 2–60"
                      value={
                        EMI_MONTH_OPTIONS.includes(formData.emiMonths)
                          ? ""
                          : formData.emiMonths
                      }
                      onChange={(e) => {
                        const v = Math.min(
                          60,
                          Math.max(2, parseInt(e.target.value) || 2),
                        );
                        setFormData({ ...formData, emiMonths: v });
                      }}
                      className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Interest Rate
                    </label>
                    <select
                      name="emiInterestPreset"
                      value={formData.emiInterestPreset}
                      onChange={handleChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    >
                      {INTEREST_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {formData.emiInterestPreset === -1 && (
                      <input
                        type="number"
                        min="0"
                        max="60"
                        step="0.1"
                        placeholder="e.g. 10.5"
                        name="emiCustomInterest"
                        value={formData.emiCustomInterest}
                        onChange={handleChange}
                        className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 placeholder-slate-600"
                      />
                    )}
                  </div>
                </div>

                {/* Processing Fee + GST row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Processing Fee (₹)
                      <span className="text-slate-600 ml-1 text-[10px]">
                        — one-time
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="emiProcessingFee"
                      value={formData.emiProcessingFee}
                      onChange={handleChange}
                      placeholder="e.g. 199"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      GST Amount (₹)
                      <span className="text-slate-600 ml-1 text-[10px]">
                        — on fee/interest
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="emiGst"
                      value={formData.emiGst}
                      onChange={handleChange}
                      placeholder="e.g. 35.82"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
                    />
                  </div>
                </div>
                {/* Always-visible GST notice */}
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    <span className="font-semibold">
                      Even No Cost EMIs attract GST
                    </span>{" "}
                    on the processing fee charged by your bank. Check your bank
                    statement for the exact amounts.
                  </p>
                </div>

                {/* Live EMI breakdown */}
                {principal > 0 && months > 0 && (
                  <div className="bg-slate-900/70 rounded-xl border border-slate-700 p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> EMI Breakdown
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Principal</span>
                        <span className="text-slate-200 font-medium">
                          ₹{fmt(principal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Interest</span>
                        <span
                          className={
                            totalInterest > 0
                              ? "text-red-400 font-medium"
                              : "text-slate-600"
                          }
                        >
                          {totalInterest > 0
                            ? `₹${fmt(totalInterest)}`
                            : "₹0 (No Cost)"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Processing Fee</span>
                        <span
                          className={
                            processingFeeAmount > 0
                              ? "text-amber-400 font-medium"
                              : "text-slate-600"
                          }
                        >
                          {processingFeeAmount > 0
                            ? `₹${fmt(processingFeeAmount)}`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">GST</span>
                        <span
                          className={
                            gstAmount > 0
                              ? "text-amber-400 font-medium"
                              : "text-slate-600"
                          }
                        >
                          {gstAmount > 0 ? `₹${fmt(gstAmount)}` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-slate-500">Duration</span>
                        <span className="text-slate-200 font-medium">
                          {months} months
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-700 pt-2 mt-1 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">
                          Monthly payment
                        </span>
                        <span className="text-emerald-400 font-bold">
                          ₹{fmt(monthlyPayment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">
                          Total cost
                        </span>
                        <span className="text-slate-200 font-bold">
                          ₹{fmt(totalCost)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1.5">
                        <span className="text-slate-500">
                          Credit limit blocked
                        </span>
                        <span className="text-orange-400 font-medium">
                          ₹{fmt(availableLimitImpact)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">
                          Counts toward AMC waiver
                        </span>
                        <span className="text-violet-400 font-medium">
                          ₹{fmt(availableLimitImpact)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border border-slate-700 rounded-xl p-4 bg-slate-800/20 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-300">
              <span>Recurring transaction</span>
              <input
                type="checkbox"
                name="isRecurring"
                checked={formData.isRecurring}
                onChange={handleChange}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>
            {formData.isRecurring && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    name="recurringFrequency"
                    value={formData.recurringFrequency}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    name="recurringInterval"
                    value={formData.recurringInterval}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="date"
                    name="recurringEndDate"
                    value={formData.recurringEndDate}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  The first occurrence is the entry you save now. Future copies
                  are added automatically based on the cadence and end date.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {initialExpense ? "Update Expense" : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
