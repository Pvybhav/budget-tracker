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
  Cell,
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
} from "../services/backend.service";

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
  const [isExporting, setIsExporting] = useState(false);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const cards = useBackendResource(() => fetchCards(), []);

  if (!expenses || !categories || !cards) {
    return <div className="p-8 text-slate-400">Loading charts...</div>;
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

  // 1. Category-wise spent in current month
  const monthlyCategoryData = categories
    .map((cat) => {
      const total = expenses
        .filter((exp) => {
          const d = new Date(exp.date);
          return (
            d.getMonth() === currentMonth &&
            d.getFullYear() === currentYear &&
            exp.categoryId === cat.id
          );
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
      return { name: cat.title, amount: total };
    })
    .filter((d) => d.amount > 0);

  // 2. Category-wise spent for the year
  const yearlyCategoryData = categories
    .map((cat) => {
      const total = expenses
        .filter((exp) => {
          const d = new Date(exp.date);
          return d.getFullYear() === currentYear && exp.categoryId === cat.id;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
      return { name: cat.title, amount: total };
    })
    .filter((d) => d.amount > 0);

  // 3. Total trend for the last 6 months
  const monthlyTrendData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentYear, currentMonth - (5 - index), 1);
    const label = date.toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
    const total = expenses
      .filter((exp) => {
        const d = new Date(exp.date);
        return (
          d.getMonth() === date.getMonth() &&
          d.getFullYear() === date.getFullYear()
        );
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { month: label, amount: total };
  });

  // 4. Category share by month and year
  const categoryShareMonthlyData = monthlyCategoryData;
  const categoryShareYearlyData = yearlyCategoryData;

  const ChartCard = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[400px]">
      <h3 className="text-slate-200 font-semibold mb-6 text-lg">{title}</h3>
      <div className="flex-1 w-full min-h-0">{children}</div>
    </div>
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl outline-none">
          <p className="text-slate-200 font-medium mb-1">{payload[0].name}</p>
          <p className="text-emerald-400 font-bold">
            ₹{payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      const trendSheet = [
        ["Month", "Spending (₹)"],
        ...monthlyTrendData.map((row) => [row.month, row.amount]),
        [],
        [
          "Total (6 months)",
          monthlyTrendData.reduce((sum, row) => sum + row.amount, 0),
        ],
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(trendSheet),
        "Spending Trend",
      );

      if (categoryShareMonthlyData.length > 0) {
        const monthlySheet = [
          ["Category", "Amount (₹)"],
          ...categoryShareMonthlyData.map((row) => [row.name, row.amount]),
          [],
          [
            "Total",
            categoryShareMonthlyData.reduce((sum, row) => sum + row.amount, 0),
          ],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(monthlySheet),
          "Category Share (Month)",
        );
      }

      if (categoryShareYearlyData.length > 0) {
        const yearlySheet = [
          ["Category", "Amount (₹)"],
          ...categoryShareYearlyData.map((row) => [row.name, row.amount]),
          [],
          [
            "Total",
            categoryShareYearlyData.reduce((sum, row) => sum + row.amount, 0),
          ],
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Visualize</h1>
          <p className="text-slate-400">
            Spending and category share trends for{" "}
            {now.toLocaleString("default", { month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportReport}
          disabled={isExporting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? "Preparing report..." : "Export visual report"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard title="Spending Trend (Last 6 Months)">
          {monthlyTrendData.some((row) => row.amount > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "#1e293b", strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              No spending data available
            </div>
          )}
        </ChartCard>

        <ChartCard title="Spending by Category (This Month)">
          {monthlyCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCategoryData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#1e293b" }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              No data for this month
            </div>
          )}
        </ChartCard>

        <ChartCard title="Category Share (This Month)">
          {categoryShareMonthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryShareMonthlyData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryShareMonthlyData.map((_, index) => (
                    <Cell
                      key={`cell-month-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              No category share data for this month
            </div>
          )}
        </ChartCard>

        <ChartCard title="Category Share (This Year)">
          {categoryShareYearlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryShareYearlyData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryShareYearlyData.map((_, index) => (
                    <Cell
                      key={`cell-year-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              No category share data for this year
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
