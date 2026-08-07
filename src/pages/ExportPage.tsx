import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { FileSpreadsheet, Download, Calendar } from "lucide-react";
import { showAlert } from "../components/Confirm";
import * as XLSX from "xlsx";

export default function ExportPage() {
  const cards = useLiveQuery(() => db.cards.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const payments = useLiveQuery(() => db.payments.toArray());

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    if (!cards || !expenses || !payments || !categories) return;

    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // 1. Export Expenses by Card
      cards.forEach((card) => {
        const cardExpenses = expenses.filter((exp) => {
          const d = new Date(exp.date);
          return (
            d.getMonth() === selectedMonth &&
            d.getFullYear() === selectedYear &&
            exp.cardId === card.id
          );
        });

        if (cardExpenses.length > 0) {
          const sheetData = cardExpenses.map((exp) => {
            const cat = categories.find((c) => c.id === exp.categoryId);
            return [
              new Date(exp.date).toLocaleDateString(),
              cat?.title || "Uncategorized",
              exp.details || "",
              exp.amount,
            ];
          });

          const total = cardExpenses.reduce((sum, e) => sum + e.amount, 0);

          // Add Headers and Footer
          const finalData = [
            ["Date", "Category", "Details", "Amount (₹)"],
            ...sheetData,
            [],
            ["Total", "", "", total],
          ];

          const ws = XLSX.utils.aoa_to_sheet(finalData);
          XLSX.utils.book_append_sheet(
            wb,
            ws,
            `Exp - ${card.title.slice(0, 20)}`,
          );
        }
      });

      // 2. Export Payments by Card
      cards.forEach((card) => {
        const cardPayments = payments.filter((p) => {
          const d = new Date(p.date);
          return (
            d.getMonth() === selectedMonth &&
            d.getFullYear() === selectedYear &&
            p.cardId === card.id
          );
        });

        if (cardPayments.length > 0) {
          const sheetData = cardPayments.map((p) => [
            new Date(p.date).toLocaleDateString(),
            p.amount,
          ]);

          const total = cardPayments.reduce((sum, p) => sum + p.amount, 0);

          // Add Headers and Footer
          const finalData = [
            ["Date", "Amount (₹)"],
            ...sheetData,
            [],
            ["Total", total],
          ];

          const ws = XLSX.utils.aoa_to_sheet(finalData);
          XLSX.utils.book_append_sheet(
            wb,
            ws,
            `Pay - ${card.title.slice(0, 20)}`,
          );
        }
      });

      if (wb.SheetNames.length === 0) {
        await showAlert("No data found for the selected month and year.");
        return;
      }

      // 3. Generate File
      const fileName = `CreditWisely_Export_${months[selectedMonth]}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Export failed:", error);
      await showAlert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Export Monthly Data</h1>
          <p className="text-slate-400">
            Download your card expenses and payments as an Excel file
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Select Month
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
              >
                {months.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Select Year
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20"
        >
          {isExporting ? (
            "Preparing Excel..."
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download Excel Report
            </>
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="text-slate-200 font-medium mb-4">Export Details:</h3>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Separate sheets for each credit card
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Categorized expense lists with total sum
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Payment logs with total sum
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Microsoft Excel (.xlsx) format
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
