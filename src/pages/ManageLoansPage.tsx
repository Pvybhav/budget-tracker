import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBackendResource } from "../services/backendHooks";
import { type Loan, type LoanRepayment } from "../db/db";
import AddLoanModal from "../components/modals/AddLoanModal";
import {
  calcMonthlyEmi,
  getEmiSchedule,
  type EmiScheduleStatus,
} from "../services/card.service";
import { deleteLoan, updateLoan } from "../services/backendSync";
import { fetchLoans } from "../services/backend.service";

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

function getLoanRemainingBalance(loan: Loan): number {
  const schedule = getEmiSchedule(
    loan.principal,
    loan.annualInterestRate,
    loan.termMonths,
    loan.startDate,
  );
  const paidPaymentNumbers = new Set(
    (loan.repayments ?? [])
      .filter((repayment) => repayment.paid)
      .map((repayment) => repayment.paymentNumber),
  );
  const paidPrincipal = schedule.reduce(
    (total, row) =>
      paidPaymentNumbers.has(row.paymentNumber)
        ? total + row.principalAmount
        : total,
    0,
  );

  return Math.max(0, loan.principal - paidPrincipal);
}

export default function ManageLoansPage() {
  const loans = useBackendResource(() => fetchLoans(), []);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedRepaymentNumber, setSelectedRepaymentNumber] = useState<
    number | null
  >(null);
  const [editingRepaymentNumber, setEditingRepaymentNumber] = useState<
    number | null
  >(null);
  const [repaymentDraft, setRepaymentDraft] = useState<LoanRepayment | null>(
    null,
  );
  const [paidRepaymentNumber, setPaidRepaymentNumber] = useState<number | null>(
    null,
  );
  const [paidDate, setPaidDate] = useState(todayIso);
  const [paidNote, setPaidNote] = useState("");

  const schedule = useMemo(() => {
    if (!selectedLoan) return [];
    return getEmiSchedule(
      selectedLoan.principal,
      selectedLoan.annualInterestRate,
      selectedLoan.termMonths,
      selectedLoan.startDate,
    );
  }, [selectedLoan]);

  const selectedRepayment = schedule.find(
    (row) => row.paymentNumber === selectedRepaymentNumber,
  );
  const selectedRepaymentRecord = selectedLoan?.repayments?.find(
    (item) => item.paymentNumber === selectedRepaymentNumber,
  );

  const handleDelete = async (loan: Loan) => {
    await deleteLoan(loan.id!);
    if (selectedLoan?.id === loan.id) {
      setSelectedLoan(null);
    }
  };

  const handleRepaymentChange = async (
    paymentNumber: number,
    paid: boolean,
    paidDate: string,
    note: string,
  ) => {
    if (!selectedLoan?.id) return;

    const repayments = [...(selectedLoan.repayments ?? [])];
    const repayment: LoanRepayment = {
      paymentNumber,
      paid,
      ...(paidDate ? { paidDate } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const existingIndex = repayments.findIndex(
      (item) => item.paymentNumber === paymentNumber,
    );

    if (existingIndex >= 0) {
      repayments[existingIndex] = repayment;
    } else {
      repayments.push(repayment);
    }

    const updatedLoan = await updateLoan(selectedLoan.id, { repayments });
    setSelectedLoan({ ...selectedLoan, ...updatedLoan, repayments });
  };

  const startRepaymentEdit = (
    paymentNumber: number,
    repayment?: LoanRepayment,
  ) => {
    setEditingRepaymentNumber(paymentNumber);
    setRepaymentDraft(
      repayment ?? {
        paymentNumber,
        paid: false,
      },
    );
  };

  const cancelRepaymentEdit = () => {
    setEditingRepaymentNumber(null);
    setRepaymentDraft(null);
  };

  const saveRepaymentEdit = async () => {
    if (!repaymentDraft) return;
    await handleRepaymentChange(
      repaymentDraft.paymentNumber,
      repaymentDraft.paid,
      repaymentDraft.paidDate ?? "",
      repaymentDraft.note ?? "",
    );
    cancelRepaymentEdit();
  };

  const openPaidDialog = (paymentNumber: number) => {
    setPaidRepaymentNumber(paymentNumber);
    setPaidDate(todayIso);
    setPaidNote("");
  };

  const closePaidDialog = () => {
    setPaidRepaymentNumber(null);
    setPaidDate(todayIso);
    setPaidNote("");
  };

  const closeRepaymentDetails = () => {
    setSelectedRepaymentNumber(null);
    cancelRepaymentEdit();
  };

  const savePaidRepayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (paidRepaymentNumber === null) return;
    await handleRepaymentChange(paidRepaymentNumber, true, paidDate, paidNote);
    closePaidDialog();
  };

  const handleEditKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveRepaymentEdit();
    }
  };

  const handleViewFullScreen = () => {
    alert("This feature is not yet implemented. Please check back later.");

    return;
    // if (selectedLoan) {
    //   window.open(`/loans/${selectedLoan.id}`, "_blank");
    // }
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
          onClick={() => {
            setEditingLoan(null);
            setIsModalOpen(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Loan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <div className="font-semibold mb-1">Completed</div>
          <div className="text-emerald-100/70">
            Loan fully repaid or EMI past due date.
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold mb-1">Due this month</div>
          <div className="text-amber-100/70">
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
              <th className="px-6 py-4 font-medium">Remaining Balance</th>
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
                <>
                  <tr
                    key={loan.id}
                    onClick={() =>
                      setSelectedLoan((currentLoan) =>
                        currentLoan?.id === loan.id ? null : loan,
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedLoan((currentLoan) =>
                          currentLoan?.id === loan.id ? null : loan,
                        );
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={selectedLoan?.id === loan.id}
                    className="cursor-pointer hover:bg-slate-800/20 transition-colors"
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
                    <td className="px-6 py-4">
                      ₹
                      {monthlyEmi.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      ₹
                      {totalCost.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      ₹
                      {getLoanRemainingBalance(loan).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate">
                      {loan.note || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          getLoanStatus(loan) === "completed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : getLoanStatus(loan) === "due"
                              ? "bg-amber-500/15 text-amber-300"
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
                    <td
                      className="px-6 py-4 text-right space-x-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setSelectedLoan(null);
                          setIsModalOpen(true);
                          setEditingLoan(loan);
                        }}
                        className="text-slate-300 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(loan)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  <tr
                    className={selectedLoan?.id === loan.id ? "" : "hidden"}
                    aria-hidden={selectedLoan?.id !== loan.id}
                  >
                    <td colSpan={11} className="p-0">
                      <div id={`loan-schedule-${loan.id}`} />
                    </td>
                  </tr>
                </>
              );
            })}
            {(!loans || loans.length === 0) && (
              <tr>
                <td
                  colSpan={11}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No loans found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TODO: use different color for highlighted row and background of schedule card background */}
      {selectedLoan &&
        createPortal(
          <div
            role="region"
            aria-label={`Repayment schedule for ${selectedLoan.lender}`}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
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
              {/* View in fullscreen view */}
              <button
                onClick={handleViewFullScreen}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                View in fullscreen
              </button>
            </div>

            <div className="overflow-x-auto mt-6 min-w-max bg-slate-800 rounded-lg">
              <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="w-12 px-2 py-3 text-center font-medium">
                      #
                    </th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Payment status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {schedule.map((row) =>
                    (() => {
                      const repayment = selectedLoan.repayments?.find(
                        (item) => item.paymentNumber === row.paymentNumber,
                      );
                      const isPaid = repayment?.paid ?? false;
                      const isOverdue = !isPaid && row.dueDate < todayIso;

                      return (
                        <tr
                          key={row.paymentNumber}
                          className={`transition-colors ${
                            isOverdue
                              ? "bg-red-500/10"
                              : row.status === "completed"
                                ? "bg-emerald-500/10"
                                : row.status === "due"
                                  ? "bg-amber-500/10"
                                  : "bg-sky-500/10"
                          } hover:bg-slate-800/70`}
                        >
                          <td className="w-12 px-2 py-3 text-center">
                            {row.paymentNumber}
                          </td>
                          <td className="px-4 py-3">{row.dueDate}</td>
                          <td className="px-4 py-3">
                            ₹
                            {row.paymentAmount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                isOverdue
                                  ? "font-semibold text-red-300"
                                  : isPaid
                                    ? "text-emerald-300"
                                    : "text-slate-400"
                              }
                            >
                              {isOverdue
                                ? "Not paid · overdue"
                                : isPaid
                                  ? "Paid"
                                  : "Not paid"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedRepaymentNumber(row.paymentNumber)
                                }
                                className="inline-flex min-h-9 w-28 shrink-0 items-center px-2 text-cyan-400 hover:text-cyan-300"
                              >
                                View details
                              </button>
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPaidDialog(row.paymentNumber)
                                  }
                                  className="inline-flex min-h-9 w-28 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600/20 px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200"
                                >
                                  Mark as Paid
                                </button>
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="h-9 w-28 shrink-0"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRepaymentNumber(row.paymentNumber);
                                  startRepaymentEdit(
                                    row.paymentNumber,
                                    repayment,
                                  );
                                }}
                                className="inline-flex min-h-9 w-14 shrink-0 items-center justify-center px-2 text-slate-300 hover:text-white"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })(),
                  )}
                </tbody>
              </table>
            </div>
          </div>,
          document.getElementById(`loan-schedule-${selectedLoan.id}`)!,
        )}

      {selectedLoan &&
        selectedRepayment &&
        selectedRepaymentNumber !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Payment {selectedRepayment.paymentNumber} details
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Due {selectedRepayment.dueDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeRepaymentDetails}
                  className="text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-slate-500">Payment</div>
                  <div className="mt-1 text-slate-100">
                    ₹
                    {selectedRepayment.paymentAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Principal</div>
                  <div className="mt-1 text-slate-100">
                    ₹
                    {selectedRepayment.principalAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Interest</div>
                  <div className="mt-1 text-slate-100">
                    ₹
                    {selectedRepayment.interestAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Remaining balance</div>
                  <div className="mt-1 text-slate-100">
                    ₹
                    {selectedRepayment.remainingBalance.toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Status</div>
                  <div className="mt-1 text-slate-100">
                    {selectedRepaymentRecord?.paid
                      ? "Paid"
                      : selectedRepayment.dueDate < todayIso
                        ? "Not paid · overdue"
                        : "Not paid"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Paid on</div>
                  <div className="mt-1 text-slate-100">
                    {selectedRepaymentRecord?.paidDate ?? "-"}
                  </div>
                </div>
              </div>

              {editingRepaymentNumber === selectedRepaymentNumber &&
              repaymentDraft ? (
                <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-400">
                      Payment status
                    </label>
                    <select
                      value={repaymentDraft.paid ? "paid" : "not-paid"}
                      onKeyDown={handleEditKeyDown}
                      onChange={(event) => {
                        if (event.target.value === "paid") {
                          setRepaymentDraft({
                            ...repaymentDraft,
                            paid: true,
                            paidDate: repaymentDraft.paidDate ?? todayIso,
                          });
                          return;
                        }
                        setRepaymentDraft({
                          ...repaymentDraft,
                          paid: false,
                          paidDate: undefined,
                        });
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="not-paid">Not paid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-400">
                      Paid on
                    </label>
                    <input
                      type="date"
                      value={repaymentDraft.paidDate ?? ""}
                      disabled={!repaymentDraft.paid}
                      onKeyDown={handleEditKeyDown}
                      onChange={(event) =>
                        setRepaymentDraft({
                          ...repaymentDraft,
                          paidDate: event.target.value || undefined,
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-400">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={repaymentDraft.note ?? ""}
                      onKeyDown={handleEditKeyDown}
                      onChange={(event) =>
                        setRepaymentDraft({
                          ...repaymentDraft,
                          note: event.target.value,
                        })
                      }
                      placeholder="Add a note"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={cancelRepaymentEdit}
                      className="px-3 py-2 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveRepaymentEdit}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <div className="text-sm text-slate-500">Notes</div>
                  <div className="mt-1 text-sm text-slate-300">
                    {selectedRepaymentRecord?.note ?? "-"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {paidRepaymentNumber !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={savePaidRepayment}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-slate-100">
              Record payment
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Add the payment date and an optional comment.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Paid on
                </label>
                <input
                  autoFocus
                  required
                  type="date"
                  value={paidDate}
                  onChange={(event) => setPaidDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Comment <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paidNote}
                  onChange={(event) => setPaidNote(event.target.value)}
                  placeholder="Add a comment"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePaidDialog}
                className="rounded-lg px-4 py-2 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
              >
                Mark paid
              </button>
            </div>
          </form>
        </div>
      )}

      <AddLoanModal
        key={editingLoan?.id ?? "new-loan"}
        isOpen={isModalOpen}
        initialLoan={editingLoan ?? undefined}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLoan(null);
        }}
      />
    </div>
  );
}
