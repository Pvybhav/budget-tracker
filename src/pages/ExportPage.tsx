import { useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { FileSpreadsheet, Download, Calendar, Database } from "lucide-react";
import { showAlert } from "../components/Confirm";
import * as XLSX from "xlsx";
import {
  fetchCards,
  fetchCategories,
  fetchExpenses,
  fetchPayments,
  fetchLoans,
  fetchSavingsGoals,
  fetchIncomes,
  fetchRewardPoints,
  fetchInsurancePolicies,
  fetchInvestments,
  fetchBudgetRules,
  fetchAutoCategorizeRules,
} from "../services/backend.service";
import { formatDateOnly } from "../utils/date";
export default function ExportPage() {
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const loans = useBackendResource(() => fetchLoans(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);
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
  const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  const buildSnapshot = async () => {
    const [
      cardsData,
      categoriesData,
      expensesData,
      paymentsData,
      loansData,
      savingsGoalsData,
      incomesData,
      rewardPointsData,
      insurancePoliciesData,
      investmentsData,
      budgetRulesData,
      autoCategorizeRulesData,
    ] = await Promise.all([
      fetchCards(),
      fetchCategories(),
      fetchExpenses(),
      fetchPayments(),
      fetchLoans(),
      fetchSavingsGoals(),
      fetchIncomes(),
      fetchRewardPoints(),
      fetchInsurancePolicies(),
      fetchInvestments(),
      fetchBudgetRules(),
      fetchAutoCategorizeRules(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards: cardsData ?? [],
      categories: categoriesData ?? [],
      expenses: expensesData ?? [],
      payments: paymentsData ?? [],
      loans: loansData ?? [],
      savingsGoals: savingsGoalsData ?? [],
      incomes: incomesData ?? [],
      rewardPoints: rewardPointsData ?? [],
      insurancePolicies: insurancePoliciesData ?? [],
      investments: investmentsData ?? [],
      budgetRules: budgetRulesData ?? [],
      autoCategorizeRules: autoCategorizeRulesData ?? [],
    };
  };
  const handleExportExcel = async () => {
    if (!cards || !expenses || !payments || !categories || !loans || !incomes) return;
    setIsProcessing(true);
    try {
      const wb = XLSX.utils.book_new();
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
              formatDateOnly(exp.date),
              cat?.title || "Uncategorized",
              exp.details || "",
              exp.amount,
              exp.currency || "INR",
            ];
          });
          const total = cardExpenses.reduce((sum, e) => sum + e.amount, 0);
          const finalData = [
            ["Date", "Category", "Details", "Amount", "Currency"],
            ...sheetData,
            [],
            ["Total", "", "", total, ""],
          ];
          const ws = XLSX.utils.aoa_to_sheet(finalData);
          XLSX.utils.book_append_sheet(wb, ws, `Exp - ${card.title.slice(0, 20)}`);
        }
      });
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
            formatDateOnly(p.date),
            p.amount,
            p.currency || "INR",
          ]);
          const total = cardPayments.reduce((sum, p) => sum + p.amount, 0);
          const finalData = [
            ["Date", "Amount", "Currency"],
            ...sheetData,
            [],
            ["Total", total, ""],
          ];
          const ws = XLSX.utils.aoa_to_sheet(finalData);
          XLSX.utils.book_append_sheet(wb, ws, `Pay - ${card.title.slice(0, 20)}`);
        }
      });
      const loanRows = loans
        .filter((loan) => {
          const d = new Date(loan.startDate);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        })
        .map((loan) => [
          formatDateOnly(loan.startDate),
          loan.lender,
          loan.principal,
          loan.annualInterestRate,
          loan.termMonths,
          loan.note || "",
          loan.currency || "INR",
        ]);
      if (loanRows.length > 0) {
        const finalData = [
          ["Start Date", "Lender", "Principal", "Interest %", "Term (months)", "Note", "Currency"],
          ...loanRows,
        ];
        const ws = XLSX.utils.aoa_to_sheet(finalData);
        XLSX.utils.book_append_sheet(wb, ws, "Loans");
      }
      if (wb.SheetNames.length === 0) {
        await showAlert("No data found for the selected month and year.");
        return;
      }
      const fileName = `Budget_Tracker_Export_${months[selectedMonth]}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Export failed:", error);
      await showAlert("Failed to export data. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };
  const handleExportCsv = async () => {
    if (!cards || !expenses || !payments || !categories || !loans || !incomes) return;
    setIsProcessing(true);
    try {
      const rows = [["type", "date", "card", "category", "details", "amount"]];
      expenses.forEach((expense) => {
        const card = cards.find((item) => item.id === expense.cardId);
        const category = categories.find((item) => item.id === expense.categoryId);
        const date = formatDateOnly(expense.date);
        rows.push([
          "expense",
          date,
          card?.title || "Unknown",
          category?.title || "Uncategorized",
          expense.details || "",
          expense.amount.toString(),
        ]);
      });
      payments.forEach((payment) => {
        const card = cards.find((item) => item.id === payment.cardId);
        rows.push([
          "payment",
          formatDateOnly(payment.date),
          card?.title || "Unknown",
          "",
          "",
          payment.amount.toString(),
        ]);
      });
      loans.forEach((loan) => {
        rows.push([
          "loan",
          formatDateOnly(loan.startDate),
          loan.lender,
          loan.note || "",
          loan.principal.toString(),
          loan.annualInterestRate.toString(),
          loan.termMonths.toString(),
        ]);
      });
      incomes.forEach((income) => {
        const card = cards.find((item) => item.id === income.accountId);
        rows.push([
          "income",
          formatDateOnly(income.date),
          card?.title || "Unassigned",
          income.category || "other",
          income.source,
          income.amount.toString(),
        ]);
      });
      if (rows.length === 1) {
        await showAlert("No transactions available to export yet.");
        return;
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      const fileName = `Budget_Tracker_Transactions.csv`;
      downloadTextFile(csvContent, fileName, "text/csv;charset=utf-8;");
    } catch (error) {
      console.error("CSV export failed:", error);
      await showAlert("Failed to export CSV data. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };
  const handleExportJson = async () => {
    setIsProcessing(true);
    try {
      const snapshot = await buildSnapshot();
      const fileName = `Budget_Tracker_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadTextFile(
        JSON.stringify(snapshot, null, 2),
        fileName,
        "application/json;charset=utf-8;",
      );
    } catch (error) {
      console.error("JSON export failed:", error);
      await showAlert("Failed to export backup. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {" "}
      <div className="flex items-center gap-4">
        {" "}
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
          {" "}
          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />{" "}
        </div>{" "}
        <div>
          {" "}
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {" "}
            Import, Export & Backups{" "}
          </h1>{" "}
          <p className="text-slate-600 dark:text-slate-400">
            {" "}
            Download reports, create backup snapshots, and restore local data{" "}
          </p>{" "}
        </div>{" "}
      </div>{" "}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {" "}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {" "}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-400">
                {" "}
                Select Month{" "}
              </label>{" "}
              <div className="relative">
                {" "}
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />{" "}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
                >
                  {" "}
                  {months.map((m, i) => (
                    <option key={m} value={i}>
                      {" "}
                      {m}{" "}
                    </option>
                  ))}{" "}
                </select>{" "}
              </div>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-400">
                {" "}
                Select Year{" "}
              </label>{" "}
              <div className="relative">
                {" "}
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />{" "}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
                >
                  {" "}
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {" "}
                      {y}{" "}
                    </option>
                  ))}{" "}
                </select>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <button
            onClick={handleExportExcel}
            disabled={isProcessing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20"
          >
            {" "}
            {isProcessing ? (
              "Preparing export..."
            ) : (
              <>
                {" "}
                <Download className="w-5 h-5" /> Download Excel Report{" "}
              </>
            )}{" "}
          </button>{" "}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {" "}
            <button
              onClick={handleExportCsv}
              disabled={isProcessing}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {" "}
              <Download className="w-4 h-4" /> Export CSV{" "}
            </button>{" "}
            <button
              onClick={handleExportJson}
              disabled={isProcessing}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {" "}
              <Database className="w-4 h-4" /> Export JSON Backup{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {" "}
          <div className="space-y-4">
            {" "}
            <div>
              {" "}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {" "}
                Server export only{" "}
              </h2>{" "}
              <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                {" "}
                Data is stored on the server, and this page produces exports for analysis or
                archive. Local browser restore is no longer supported.{" "}
              </p>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-3xl shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {" "}
        <h3 className="text-slate-900 font-medium mb-4 dark:text-slate-200">
          {" "}
          What you can do here:{" "}
        </h3>{" "}
        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          {" "}
          <li className="flex items-center gap-2">
            {" "}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Export monthly reports as
            Excel workbooks for each card{" "}
          </li>{" "}
          <li className="flex items-center gap-2">
            {" "}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Download all transactions as
            CSV for spreadsheet tools{" "}
          </li>{" "}
          <li className="flex items-center gap-2">
            {" "}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Create JSON backups for
            archive or transfer to another system{" "}
          </li>{" "}
        </ul>{" "}
      </div>{" "}
    </div>
  );
}
