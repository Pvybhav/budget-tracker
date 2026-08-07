import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Loan } from "../db/db";
import AddLoanModal from "../components/modals/AddLoanModal";
import {
  calcMonthlyEmi,
  getEmiSchedule,
  type EmiScheduleStatus,
} from "../services/card.service";

function getLoanStatus(loan: Loan): EmiScheduleStatus {
  const start = new Date(loan.startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + loan.termMonths - 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (end < today) return "completed";
  if (
    end.getFullYear() === today.getFullYear() &&
    end.getMonth() === today.getMonth()
  ) {
    return "due";
  }
  return "upcoming";
}

export default function ManageLoansPage() {
  const loans = useLiveQuery(() => db.loans.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const schedule = useMemo(() => {
    if (!selectedLoan) return [];
    return getEmiSchedule(
      selectedLoan.principal,
      selectedLoan.annualInterestRate,
      selectedLoan.termMonths,
      selectedLoan.startDate,
    );
  }, [selectedLoan]);

  const handleDelete = async (loan: Loan) => {
    await db.loans.delete(loan.id!);
    if (selectedLoan?.id === loan.id) {
      setSelectedLoan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">
            Manage Loans
          </h1>
          <p className="text-slate-400 mt-1">
            Track personal loans and view repayment details in one place.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Loan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="font-semibold mb-1">Completed</div>
          <div className="text-slate-400">
            Loan fully repaid or EMI past due date.
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <div className="font-semibold mb-1">Due this month</div>
          <div className="text-slate-300">
            Repayment is current and due in this billing cycle.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-200">
          <div className="font-semibold mb-1">Upcoming</div>
          <div className="text-slate-300">
            Future loan payments or EMI installments.
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 font-medium">Lender</th>
              <th className="px-6 py-4 font-medium">Start Date</th>
              <th className="px-6 py-4 font-medium">Principal</th>
              <th className="px-6 py-4 font-medium">Interest</th>
              <th className="px-6 py-4 font-medium">Term</th>
              <th className="px-6 py-4 font-medium">Monthly EMI</th>
              <th className="px-6 py-4 font-medium">Total Cost</th>
              <th className="px-6 py-4 font-medium">Note</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loans?.map((loan) => {
              const monthlyEmi = calcMonthlyEmi(
                loan.principal,
                loan.annualInterestRate,
                loan.termMonths,
              );
              const totalCost = monthlyEmi * loan.termMonths;

              return (
                <tr
                  key={loan.id}
                  className="hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-6 py-4">{loan.lender}</td>
                  <td className="px-6 py-4">
                    {new Date(loan.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    ₹{loan.principal.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{loan.annualInterestRate}%</td>
                  <td className="px-6 py-4">{loan.termMonths} mo</td>
                  <td className="px-6 py-4">₹{monthlyEmi.toFixed(2)}</td>
                  <td className="px-6 py-4">₹{totalCost.toFixed(2)}</td>
                  <td className="px-6 py-4 max-w-xs truncate">
                    {loan.note || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        getLoanStatus(loan) === "completed"
                          ? "bg-slate-700 text-slate-300"
                          : getLoanStatus(loan) === "due"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-sky-500/15 text-sky-300"
                      }`}
                    >
                      {getLoanStatus(loan) === "completed"
                        ? "Completed"
                        : getLoanStatus(loan) === "due"
                          ? "Due this month"
                          : "Upcoming"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => handleDelete(loan)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {(!loans || loans.length === 0) && (
              <tr>
                <td
                  colSpan={10}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No loans found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedLoan && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">
                Repayment Schedule for {selectedLoan.lender}
              </h2>
              <p className="text-slate-400 text-sm">
                {selectedLoan.termMonths} months ·{" "}
                {selectedLoan.annualInterestRate}% annual interest
              </p>
            </div>
            <button
              onClick={() => setSelectedLoan(null)}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg transition-colors"
            >
              Close schedule
            </button>
          </div>

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Principal</th>
                  <th className="px-4 py-3 font-medium">Interest</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {schedule.map((row) => (
                  <tr
                    key={row.paymentNumber}
                    className={`transition-colors ${
                      row.status === "completed"
                        ? "bg-slate-900/80"
                        : row.status === "due"
                          ? "bg-emerald-500/10"
                          : "bg-sky-500/10"
                    } hover:bg-slate-800/70`}
                  >
                    <td className="px-4 py-3">{row.paymentNumber}</td>
                    <td className="px-4 py-3">{row.dueDate}</td>
                    <td className="px-4 py-3">
                      ₹{row.paymentAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      ₹{row.principalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      ₹{row.interestAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      ₹{row.remainingBalance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddLoanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
