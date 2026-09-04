import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBackendResource } from "../services/backendHooks";
import { type Loan, type LoanRepayment } from "../db/db";
import AddLoanModal from "../components/modals/AddLoanModal";
import { calcMonthlyEmi, getEmiSchedule, type EmiScheduleStatus } from "../services/card.service";
import { deleteLoan, updateLoan } from "../services/backendSync";
import { fetchCards, fetchLoans } from "../services/backend.service";
import showConfirm, { showAlert } from "../components/Confirm";
import { getLoanRemainingBalance } from "../services/netWorth.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import PaginationControls from "../components/PaginationControls";
import { formatDateOnly } from "../utils/date";

function getLoanStatus(loan: Loan): EmiScheduleStatus {
  const start = new Date(loan.startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + loan.termMonths - 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (end < today) return "completed";
  if (end.getFullYear() === today.getFullYear() && end.getMonth() === today.getMonth()) {
    return "due";
  }
  return "upcoming";
}

export default function ManageLoansPage() {
  const displayCurrency = useDisplayCurrency();
  const loans = useBackendResource(() => fetchLoans(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedRepaymentNumber, setSelectedRepaymentNumber] = useState<number | null>(null);
  const [editingRepaymentNumber, setEditingRepaymentNumber] = useState<number | null>(null);
  const [repaymentDraft, setRepaymentDraft] = useState<LoanRepayment | null>(null);
  const [paidRepaymentNumber, setPaidRepaymentNumber] = useState<number | null>(null);
  const [paidDate, setPaidDate] = useState(todayIso);
  const [paidNote, setPaidNote] = useState("");
  const [paidPaymentType, setPaidPaymentType] =
    useState<NonNullable<LoanRepayment["paymentType"]>>("bank");
  const [paidPaymentReference, setPaidPaymentReference] = useState("");
  const [paidPaymentSource, setPaidPaymentSource] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filteredLoans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (loans ?? []).filter(
      (loan) =>
        !query ||
        loan.lender.toLowerCase().includes(query) ||
        loan.note?.toLowerCase().includes(query),
    );
  }, [loans, search]);
  const visibleLoans = filteredLoans.slice((page - 1) * pageSize, page * pageSize);

  const schedule = useMemo(() => {
    if (!selectedLoan) return [];
    return getEmiSchedule(
      selectedLoan.principal,
      selectedLoan.annualInterestRate,
      selectedLoan.termMonths,
      selectedLoan.startDate,
    );
  }, [selectedLoan]);

  const selectedRepayment = schedule.find((row) => row.paymentNumber === selectedRepaymentNumber);
  const selectedRepaymentRecord = selectedLoan?.repayments?.find(
    (item) => item.paymentNumber === selectedRepaymentNumber,
  );
  const repaymentProgress = useMemo(() => {
    if (!selectedLoan) return { paidCount: 0, percent: 0, nextPayment: undefined };
    const paidNumbers = new Set(
      (selectedLoan.repayments ?? [])
        .filter((repayment) => repayment.paid)
        .map((repayment) => repayment.paymentNumber),
    );
    const nextPayment = schedule.find((row) => !paidNumbers.has(row.paymentNumber));
    return {
      paidCount: paidNumbers.size,
      percent: schedule.length ? Math.round((paidNumbers.size / schedule.length) * 100) : 0,
      nextPayment,
    };
  }, [selectedLoan, schedule]);

  const handleDelete = async (loan: Loan) => {
    const ok = await showConfirm(`Delete the loan from "${loan.lender}"? This cannot be undone.`, {
      title: "Delete loan",
      confirmText: "Delete",
    });
    if (!ok) return;
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
    paymentType?: LoanRepayment["paymentType"],
    paymentReference?: string,
    paymentSource?: string,
  ) => {
    if (!selectedLoan?.id) return;

    const repayments = [...(selectedLoan.repayments ?? [])];
    const repayment: LoanRepayment = {
      paymentNumber,
      paid,
      ...(paidDate ? { paidDate } : {}),
      ...(paymentType ? { paymentType } : {}),
      ...(paymentReference?.trim() ? { paymentReference: paymentReference.trim() } : {}),
      ...(paymentSource ? { paymentSource } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const existingIndex = repayments.findIndex((item) => item.paymentNumber === paymentNumber);

    if (existingIndex >= 0) {
      repayments[existingIndex] = repayment;
    } else {
      repayments.push(repayment);
    }

    const updatedLoan = await updateLoan(selectedLoan.id, { repayments });
    setSelectedLoan({ ...selectedLoan, ...updatedLoan, repayments });
  };

  const startRepaymentEdit = (paymentNumber: number, repayment?: LoanRepayment) => {
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
      repaymentDraft.paymentType,
      repaymentDraft.paymentReference,
      repaymentDraft.paymentSource,
    );
    cancelRepaymentEdit();
  };

  const openPaidDialog = (paymentNumber: number) => {
    setPaidRepaymentNumber(paymentNumber);
    setPaidDate(todayIso);
    setPaidNote("");
    setPaidPaymentType("bank");
    setPaidPaymentReference("");
    setPaidPaymentSource("");
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

  const savePaidRepayment = async (event: React.SubmitEvent) => {
    event.preventDefault();
    if (paidRepaymentNumber === null) return;
    if (["card", "bank", "upi"].includes(paidPaymentType) && !paidPaymentSource) {
      await showAlert("Select the account used for this repayment");
      return;
    }
    await handleRepaymentChange(
      paidRepaymentNumber,
      true,
      paidDate,
      paidNote,
      paidPaymentType,
      paidPaymentReference,
      paidPaymentSource,
    );
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
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Manage Loans
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
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
          <div className="text-emerald-100/70">Loan fully repaid or EMI past due date.</div>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold mb-1">Due this month</div>
          <div className="text-amber-100/70">
            Repayment is current and due in this billing cycle.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-300 dark:border-sky-500/25 bg-sky-50 dark:bg-sky-500/10 p-4 text-sm text-sky-800 dark:text-sky-200">
          <div className="font-semibold mb-1">Upcoming</div>
          <div className="text-sky-700 dark:text-slate-300">
            Future loan payments or EMI installments.
          </div>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search lenders or notes"
        aria-label="Search loans"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Lender</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Start Date
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Principal
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Interest</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Term</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Monthly EMI
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Total Cost
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Remaining Balance
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Note</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Status</th>
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleLoans.map((loan) => {
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
                      setSelectedLoan((currentLoan) => (currentLoan?.id === loan.id ? null : loan))
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
                    <td className="px-6 py-4">{formatDateOnly(loan.startDate)}</td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        convertCurrency(loan.principal, loan.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-6 py-4">{loan.annualInterestRate}%</td>
                    <td className="px-6 py-4">{loan.termMonths} mo</td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        convertCurrency(monthlyEmi, loan.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        convertCurrency(totalCost, loan.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        convertCurrency(
                          getLoanRemainingBalance(loan),
                          loan.currency,
                          displayCurrency,
                        ),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate">{loan.note || "—"}</td>
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
                        className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(loan)}
                        className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
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
            {filteredLoans.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                  {loans?.length ? "No loans match your search." : "No loans found."}
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PaginationControls
                  page={page}
                  totalItems={filteredLoans.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Repayment Schedule for {selectedLoan.lender}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {selectedLoan.termMonths} months · {selectedLoan.annualInterestRate}% annual
                  interest
                </p>
              </div>
              <button
                onClick={() => setSelectedLoan(null)}
                className="w-full sm:w-auto bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                Close schedule
              </button>
              {/* View in fullscreen view */}
              <button
                onClick={handleViewFullScreen}
                className="w-full sm:w-auto bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                View in fullscreen
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Repayment journey
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {repaymentProgress.paidCount} of {schedule.length} installments paid
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {repaymentProgress.nextPayment
                    ? `Next: installment ${repaymentProgress.nextPayment.paymentNumber} on ${repaymentProgress.nextPayment.dueDate}`
                    : "All installments paid"}
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                  style={{ width: `${repaymentProgress.percent}%` }}
                />
              </div>
              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-max items-start gap-1">
                  {schedule.map((row) => {
                    const isPaid = selectedLoan.repayments?.some(
                      (repayment) =>
                        repayment.paymentNumber === row.paymentNumber && repayment.paid,
                    );
                    const isNext =
                      repaymentProgress.nextPayment?.paymentNumber === row.paymentNumber;
                    let Icon = Circle;
                    if (isPaid) Icon = CheckCircle2;
                    if (isNext) Icon = Clock3;
                    let iconColor = "text-slate-400";
                    if (isPaid) iconColor = "text-emerald-500";
                    if (isNext) iconColor = "text-amber-500";
                    return (
                      <div
                        key={row.paymentNumber}
                        className="flex min-w-12 flex-col items-center gap-1"
                      >
                        <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                        <span
                          className={`text-[10px] ${isNext ? "font-semibold text-amber-600 dark:text-amber-300" : "text-slate-500"}`}
                        >
                          {row.paymentNumber}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto mt-6 min-w-max bg-slate-100 dark:bg-slate-800 rounded-lg">
              <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
                <thead className="bg-slate-200 dark:bg-slate-800/50 border-b border-slate-300 dark:border-slate-800">
                  <tr>
                    <th className="w-12 px-2 py-3 text-center font-medium text-slate-900 dark:text-slate-100">
                      #
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      Due Date
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      Payment
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      Payment status
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
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
                          } hover:bg-slate-100 dark:hover:bg-slate-800/70`}
                        >
                          <td className="w-12 px-2 py-3 text-center">{row.paymentNumber}</td>
                          <td className="px-4 py-3">{row.dueDate}</td>
                          <td className="px-4 py-3">
                            {formatMoney(
                              convertCurrency(
                                row.paymentAmount,
                                selectedLoan?.currency,
                                displayCurrency,
                              ),
                              displayCurrency,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                isOverdue
                                  ? "font-semibold text-red-600 dark:text-red-300"
                                  : isPaid
                                    ? "text-emerald-600 dark:text-emerald-300"
                                    : "text-slate-500 dark:text-slate-400"
                              }
                            >
                              {isOverdue ? "Not paid · overdue" : isPaid ? "Paid" : "Not paid"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedRepaymentNumber(row.paymentNumber)}
                                className="inline-flex min-h-9 w-28 shrink-0 items-center px-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
                              >
                                View details
                              </button>
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => openPaidDialog(row.paymentNumber)}
                                  className="inline-flex min-h-9 w-28 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600/20 px-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-800 dark:hover:text-emerald-200"
                                >
                                  Mark as Paid
                                </button>
                              ) : (
                                <span aria-hidden="true" className="h-9 w-28 shrink-0" />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRepaymentNumber(row.paymentNumber);
                                  startRepaymentEdit(row.paymentNumber, repayment);
                                }}
                                className="inline-flex min-h-9 w-14 shrink-0 items-center justify-center px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
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

      {selectedLoan && selectedRepayment && selectedRepaymentNumber !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-lg dark:shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Payment {selectedRepayment.paymentNumber} details
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Due {selectedRepayment.dueDate}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRepaymentDetails}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-slate-600 dark:text-slate-500">Payment</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      selectedRepayment.paymentAmount,
                      selectedLoan?.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Principal</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      selectedRepayment.principalAmount,
                      selectedLoan?.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Interest</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      selectedRepayment.interestAmount,
                      selectedLoan?.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Remaining balance</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      selectedRepayment.remainingBalance,
                      selectedLoan?.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Status</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {selectedRepaymentRecord?.paid
                    ? "Paid"
                    : selectedRepayment.dueDate < todayIso
                      ? "Not paid · overdue"
                      : "Not paid"}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Paid on</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {selectedRepaymentRecord?.paidDate ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-500">Paid with</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {selectedRepaymentRecord?.paymentSource
                    ? (cards?.find((card) => card.id === selectedRepaymentRecord.paymentSource)
                        ?.title ?? "Linked account")
                    : (selectedRepaymentRecord?.paymentType ?? "-")}
                </div>
              </div>
            </div>

            {editingRepaymentNumber === selectedRepaymentNumber && repaymentDraft ? (
              <div className="mt-6 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-200"
                  >
                    <option value="not-paid">Not paid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelRepaymentEdit}
                    className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
              <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="text-sm text-slate-500">Notes</div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Record payment
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Add the payment date and an optional comment.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Paid on
                </label>
                <input
                  autoFocus
                  required
                  type="date"
                  value={paidDate}
                  onChange={(event) => setPaidDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Comment <span className="text-slate-400 dark:text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paidNote}
                  onChange={(event) => setPaidNote(event.target.value)}
                  placeholder="Add a comment"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="loan-payment-type"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Paid with
                </label>
                <select
                  id="loan-payment-type"
                  value={paidPaymentType}
                  onChange={(event) =>
                    (() => {
                      const paymentType = event.target.value as NonNullable<
                        LoanRepayment["paymentType"]
                      >;
                      setPaidPaymentType(paymentType);
                      setPaidPaymentSource("");
                    })()
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="bank">Bank account</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {["card", "bank", "upi"].includes(paidPaymentType) && (
                <div>
                  <label
                    htmlFor="loan-payment-source"
                    className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    {paidPaymentType === "upi" ? "Linked UPI bank account" : "Payment account"}
                  </label>
                  <select
                    id="loan-payment-source"
                    required
                    value={paidPaymentSource}
                    onChange={(event) => setPaidPaymentSource(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="">
                      {paidPaymentType === "card"
                        ? "Select a credit card..."
                        : "Select a bank account..."}
                    </option>
                    {cards
                      ?.filter((card) =>
                        paidPaymentType === "card" ? card.type === "credit" : card.type === "bank",
                      )
                      .map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label
                  htmlFor="loan-payment-reference"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Transaction reference (optional)
                </label>
                <input
                  id="loan-payment-reference"
                  value={paidPaymentReference}
                  onChange={(event) => setPaidPaymentReference(event.target.value)}
                  placeholder="Transaction ID"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePaidDialog}
                className="rounded-lg px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
