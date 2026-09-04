import { useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";
import { Download } from "lucide-react";
import { showAlert } from "../components/Confirm";
import * as XLSX from "xlsx";
import {
  fetchExpenses,
  fetchCategories,
  fetchCards,
  fetchIncomes,
} from "../services/backend.service";
import {
  convertCurrency,
  formatMoney,
  getCurrencySymbol,
  useDisplayCurrency,
} from "../services/currency.service";

interface TooltipProps {
  readonly active?: boolean;
  readonly currency?: string;
  readonly payload?: Array<{
    value: number;
    payload: {
      name: string;
      amount: number;
      categoryBreakdown?: Array<{ name: string; amount: number }>;
    };
  }>;
}
interface TrendTooltipProps extends TooltipProps {
  readonly label?: string | number;
}
const CustomTooltip = ({ active, payload, currency }: TooltipProps) => {
  if (active && payload?.length) {
    const categoryName = payload[0].payload.name;
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl outline-none">
        {" "}
        <p className="text-slate-200 font-medium mb-1">{categoryName}</p>{" "}
        <p className="text-emerald-400 font-bold">
          {" "}
          {formatMoney(payload[0].value, currency)}{" "}
        </p>{" "}
      </div>
    );
  }
  return null;
};
const TrendTooltip = ({ active, payload, label, currency }: TrendTooltipProps) => {
  if (active && payload?.length) {
    const categoryBreakdown = payload[0].payload.categoryBreakdown ?? [];
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl outline-none">
        {" "}
        <p className="text-slate-200 font-medium mb-1">{label}</p>{" "}
        <p className="text-emerald-400 font-bold mb-2">
          {" "}
          Total: {formatMoney(payload[0].value, currency)}{" "}
        </p>{" "}
        {categoryBreakdown.length > 0 && (
          <ul className="space-y-1">
            {" "}
            {categoryBreakdown.map((cat: { name: string; amount: number }) => (
              <li key={cat.name} className="flex items-center justify-between gap-4 text-sm">
                {" "}
                <span className="text-slate-700 dark:text-slate-300">{cat.name}</span>{" "}
                <span className="text-slate-900 dark:text-slate-100 font-medium">
                  {" "}
                  {formatMoney(cat.amount, currency)}{" "}
                </span>{" "}
              </li>
            ))}{" "}
          </ul>
        )}{" "}
      </div>
    );
  }
  return null;
};
interface ChartCardProps {
  readonly title: string;
  readonly children: React.ReactNode;
}
const ChartCard = ({ title, children }: ChartCardProps) => (
  <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col h-[400px] shadow-sm dark:border-slate-800 dark:bg-slate-900">
    {" "}
    <h3 className="text-slate-900 font-semibold mb-6 text-lg dark:text-slate-200">{title}</h3>{" "}
    <div className="flex-1 w-full min-h-0">{children}</div>{" "}
  </div>
);

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export default function VisualizePage() {
  const displayCurrency = useDisplayCurrency();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);

  if (!expenses || !categories || !cards || !incomes) {
    return <div className="p-8 text-slate-600 dark:text-slate-400">Loading charts...</div>;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const selectedMonthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // 1. Category-wise spent in the selected month
  const monthlyCategoryData = categories
    .map((cat, index) => {
      const total = expenses
        .filter((exp) => {
          const d = new Date(exp.date);
          return (
            d.getMonth() === selectedMonth &&
            d.getFullYear() === selectedYear &&
            exp.categoryId === cat.id
          );
        })
        .reduce((sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency), 0);
      return { name: cat.title, amount: total, fill: COLORS[index % COLORS.length] };
    })
    .filter((d) => d.amount > 0);

  // 2. Category-wise spent for the year
  const yearlyCategoryData = categories
    .map((cat, index) => {
      const total = expenses
        .filter((exp) => {
          const d = new Date(exp.date);
          return d.getFullYear() === currentYear && exp.categoryId === cat.id;
        })
        .reduce((sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency), 0);
      return { name: cat.title, amount: total, fill: COLORS[index % COLORS.length] };
    })
    .filter((d) => d.amount > 0);

  // 3. Total trend for the last 6 months
  const monthlyTrendData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentYear, currentMonth - (5 - index), 1);
    const label = date.toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
    const monthExpenses = expenses.filter((exp) => {
      const d = new Date(exp.date);
      return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });
    const total = monthExpenses.reduce(
      (sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency),
      0,
    );
    const categoryBreakdown = categories
      .map((cat) => ({
        name: cat.title,
        amount: monthExpenses
          .filter((exp) => exp.categoryId === cat.id)
          .reduce(
            (sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency),
            0,
          ),
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return { month: label, amount: total, categoryBreakdown };
  });
  // 4. Category share by month and year
  const categoryShareMonthlyData = monthlyCategoryData;
  const categoryShareYearlyData = yearlyCategoryData;
  // 5. Income vs Expense for the last 6 months
  const incomeVsExpenseData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentYear, currentMonth - (5 - index), 1);
    const label = date.toLocaleString("default", { month: "short", year: "numeric" });
    const expenseTotal = expenses
      .filter((exp) => {
        const d = new Date(exp.date);
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      })
      .reduce((sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency), 0);
    const incomeTotal = incomes
      .filter((inc) => {
        const d = new Date(inc.date);
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      })
      .reduce((sum, inc) => sum + convertCurrency(inc.amount, inc.currency, displayCurrency), 0);
    return { month: label, income: incomeTotal, expense: expenseTotal };
  });
  // 6. Income by category for the selected month
  const incomeByCategoryData = Object.entries(
    incomes
      .filter((inc) => {
        const d = new Date(inc.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce<Record<string, number>>((acc, inc) => {
        const key = inc.category ?? "other";
        acc[key] = (acc[key] ?? 0) + convertCurrency(inc.amount, inc.currency, displayCurrency);
        return acc;
      }, {}),
  ).map(([name, amount], index) => ({ name, amount, fill: COLORS[index % COLORS.length] }));
  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const trendSheet = [
        ["Month", `Spending (${displayCurrency})`],
        ...monthlyTrendData.map((row) => [row.month, row.amount]),
        [],
        ["Total (6 months)", monthlyTrendData.reduce((sum, row) => sum + row.amount, 0)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendSheet), "Spending Trend");
      if (categoryShareMonthlyData.length > 0) {
        const monthlySheet = [
          ["Category", `Amount (${displayCurrency})`],
          ...categoryShareMonthlyData.map((row) => [row.name, row.amount]),
          [],
          ["Total", categoryShareMonthlyData.reduce((sum, row) => sum + row.amount, 0)],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(monthlySheet),
          "Category Share (Month)",
        );
      }
      if (categoryShareYearlyData.length > 0) {
        const yearlySheet = [
          ["Category", `Amount (${displayCurrency})`],
          ...categoryShareYearlyData.map((row) => [row.name, row.amount]),
          [],
          ["Total", categoryShareYearlyData.reduce((sum, row) => sum + row.amount, 0)],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(yearlySheet),
          "Category Share (Year)",
        );
      }
      if (wb.SheetNames.length === 0) {
        await showAlert("No chart data available to export.");
        return;
      }
      const fileName = `Budget_Tracker_Visual_Report_${months[currentMonth]}_${currentYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Export failed:", error);
      await showAlert("Failed to export the visual report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <div className="space-y-8 pb-12">
      {" "}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Visualize</h1>{" "}
          <p className="text-slate-600 dark:text-slate-400">
            {" "}
            Spending and category share trends for {selectedMonthLabel}{" "}
          </p>{" "}
        </div>{" "}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {" "}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {" "}
            <label htmlFor="visualize-month" className="text-slate-600 dark:text-slate-400">
              {" "}
              Month{" "}
            </label>{" "}
            <select
              id="visualize-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-900 outline-none ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {" "}
              {months.map((month, index) => (
                <option key={month} value={index}>
                  {" "}
                  {month}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {" "}
            <label htmlFor="visualize-year" className="text-slate-600 dark:text-slate-400">
              {" "}
              Year{" "}
            </label>{" "}
            <select
              id="visualize-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-900 outline-none ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {" "}
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
                <option key={year} value={year}>
                  {" "}
                  {year}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <button
            type="button"
            onClick={handleExportReport}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {" "}
            <Download className="w-4 h-4" />{" "}
            {isExporting ? "Preparing report..." : "Export visual report"}{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {" "}
        <ChartCard title="Spending Trend (Last 6 Months)">
          {" "}
          {monthlyTrendData.some((row) => row.amount > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <LineChart data={monthlyTrendData}>
                {" "}
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />{" "}
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />{" "}
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${getCurrencySymbol(displayCurrency)}${value}`}
                />{" "}
                <Tooltip
                  content={<TrendTooltip currency={displayCurrency} />}
                  cursor={{ stroke: "#1e293b", strokeWidth: 2 }}
                />{" "}
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />{" "}
              </LineChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No spending data available{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
        <ChartCard title={`Spending by Category (${selectedMonthLabel})`}>
          {" "}
          {monthlyCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <BarChart
                data={monthlyCategoryData}
                margin={{ top: 0, right: 0, left: 0, bottom: 24 }}
              >
                {" "}
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />{" "}
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />{" "}
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${getCurrencySymbol(displayCurrency)}${value}`}
                />{" "}
                <Tooltip
                  content={<CustomTooltip currency={displayCurrency} />}
                  cursor={{ fill: "#1e293b" }}
                />{" "}
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />{" "}
              </BarChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No data for {selectedMonthLabel}{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
        <ChartCard title={`Category Share (${selectedMonthLabel})`}>
          {" "}
          {categoryShareMonthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <PieChart>
                {" "}
                <Pie
                  data={categoryShareMonthlyData}
                  cx="50%"
                  cy="38%"
                  labelLine={false}
                  outerRadius="70%"
                  fill="#8884d8"
                  dataKey="amount"
                />{" "}
                <Tooltip content={<CustomTooltip currency={displayCurrency} />} />{" "}
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />{" "}
              </PieChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No category share data for {selectedMonthLabel}{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
        <ChartCard title="Category Share (This Year)">
          {" "}
          {categoryShareYearlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <PieChart>
                {" "}
                <Pie
                  data={categoryShareYearlyData}
                  cx="50%"
                  cy="38%"
                  labelLine={false}
                  outerRadius="70%"
                  fill="#8884d8"
                  dataKey="amount"
                />{" "}
                <Tooltip content={<CustomTooltip currency={displayCurrency} />} />{" "}
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />{" "}
              </PieChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No category share data for this year{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
      </div>{" "}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {" "}
        <ChartCard title="Income vs Expense (Last 6 Months)">
          {" "}
          {incomeVsExpenseData.some((row) => row.income > 0 || row.expense > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <BarChart data={incomeVsExpenseData}>
                {" "}
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />{" "}
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />{" "}
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${getCurrencySymbol(displayCurrency)}${value}`}
                />{" "}
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                  }}
                  formatter={(value) => formatMoney(Number(value), displayCurrency)}
                />{" "}
                <Legend />{" "}
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />{" "}
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />{" "}
              </BarChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No income/expense data available{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
        <ChartCard title={`Income by Category (${selectedMonthLabel})`}>
          {" "}
          {incomeByCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {" "}
              <PieChart>
                {" "}
                <Pie
                  data={incomeByCategoryData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                />{" "}
                <Tooltip content={<CustomTooltip currency={displayCurrency} />} />{" "}
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />{" "}
              </PieChart>{" "}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {" "}
              No income recorded for {selectedMonthLabel}{" "}
            </div>
          )}{" "}
        </ChartCard>{" "}
      </div>{" "}
    </div>
  );
}
