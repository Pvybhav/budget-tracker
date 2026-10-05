import { useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { type Loan, type LoanRepayment } from "../db/db";
import AddLoanModal from "../components/modals/AddLoanModal";
import { calcMonthlyEmi, getEmiSchedule } from "../services/card.service";
import { deleteLoan, updateLoan } from "../services/backendSync";
import { fetchCards, fetchLoans } from "../services/backend.service";
import showConfirm, { showAlert } from "../components/Confirm";
import { getLoanRemainingBalance } from "../services/netWorth.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { Pencil, Search, Trash2 } from "lucide-react";
import PaginationControls from "../components/PaginationControls";
import { formatDateOnly, todayDateInput } from "../utils/date";
import Tooltip from "../components/Tooltip";

function getLoanProgress(loan: Loan) {
  const totalMonths = Math.max(0, loan.termMonths);
  const paidMonths = Math.min(
    totalMonths,
    new Set(
      (loan.repayments ?? [])
        .filter((repayment) => repayment.paid)
        .map((repayment) => repayment.paymentNumber),
    ).size,
  );
  return {
    paidMonths,
    remainingMonths: totalMonths - paidMonths,
    percent: totalMonths ? Math.round((paidMonths / totalMonths) * 100) : 0,
  };
}

export default function ManageLoansPage() {
  const displayCurrency = useDisplayCurrency();
  const loans = useBackendResource(() => fetchLoans(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const todayIso = todayDateInput();
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
  const [loanSort, setLoanSort] = useState<"months-asc" | "months-desc">("months-asc");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const filteredLoans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (loans ?? []).filter(
      (loan) =>
        !query ||
        loan.lender.toLowerCase().includes(query) ||
        loan.note?.toLowerCase().includes(query),
    );
  }, [loans, search]);
  const sortedLoans = useMemo(
    () =>
      [...filteredLoans].sort((left, right) => {
        const difference =
          getLoanProgress(left).remainingMonths - getLoanProgress(right).remainingMonths;
        return loanSort === "months-asc" ? difference : -difference;
      }),
    [filteredLoans, loanSort],
  );
  const visibleLoans = sortedLoans.slice((page - 1) * pageSize, page * pageSize);
  const loanSummary = useMemo(() => {
    const loanList = loans ?? [];
    return {
      totalLoans: loanList.length,
      totalPrincipal: loanList.reduce(
        (sum, loan) => sum + convertCurrency(loan.principal, loan.currency, displayCurrency),
        0,
      ),
      outstandingBalance: loanList.reduce(
        (sum, loan) =>
          sum + convertCurrency(getLoanRemainingBalance(loan), loan.currency, displayCurrency),
        0,
      ),
      monthlyEmi: loanList.reduce(
        (sum, loan) =>
          sum +
          convertCurrency(
            calcMonthlyEmi(loan.principal, loan.annualInterestRate, loan.termMonths),
            loan.currency,
            displayCurrency,
          ),
        0,
      ),
    };
  }, [displayCurrency, loans]);

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total loans</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-700 dark:text-cyan-200">
            {loanSummary.totalLoans}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total principal</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatMoney(loanSummary.totalPrincipal, displayCurrency)}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Outstanding balance</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-200">
            {formatMoney(loanSummary.outstandingBalance, displayCurrency)}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Monthly EMI</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-200">
            {formatMoney(loanSummary.monthlyEmi, displayCurrency)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search loans"
            aria-label="Search loans"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap">Months remaining</span>
          <select
            value={loanSort}
            onChange={(event) => {
              setLoanSort(event.target.value as typeof loanSort);
              setPage(1);
            }}
            className="min-w-36 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="months-asc">Fewest first</option>
            <option value="months-desc">Most first</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">Loan</th>
                <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Principal
                </th>
                <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Monthly payment
                </th>
                <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Outstanding
                </th>
                <th className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Repayment progress
                </th>
                <th className="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
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
                const progress = getLoanProgress(loan);
                return (
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
                    className="cursor-pointer transition-colors hover:bg-cyan-50/60 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {loan.lender}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {loan.annualInterestRate}% interest · Started{" "}
                        {formatDateOnly(loan.startDate)}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(
                        convertCurrency(loan.principal, loan.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {formatMoney(
                        convertCurrency(monthlyEmi, loan.currency, displayCurrency),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatMoney(
                        convertCurrency(
                          getLoanRemainingBalance(loan),
                          loan.currency,
                          displayCurrency,
                        ),
                        displayCurrency,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {progress.paidMonths} of {loan.termMonths} payments
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {progress.remainingMonths} mo left
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-cyan-500 transition-all"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </td>
                    <td
                      className="px-5 py-4 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Tooltip content="Edit loan">
                        <button
                          onClick={() => {
                            setSelectedLoan(null);
                            setIsModalOpen(true);
                            setEditingLoan(loan);
                          }}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                          aria-label={`Edit ${loan.lender}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete loan">
                        <button
                          onClick={() => handleDelete(loan)}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                          aria-label={`Delete ${loan.lender}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {loans?.length ? "No loans match your search." : "No loans found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          totalItems={filteredLoans.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {selectedLoan && (
        <section
          role="region"
          aria-label={`Repayment schedule for ${selectedLoan.lender}`}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {selectedLoan.lender} schedule
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {selectedLoan.termMonths} installments · {selectedLoan.annualInterestRate}% annual
                interest · Started {formatDateOnly(selectedLoan.startDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLoan(null)}
              className="self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:self-auto"
            >
              Close schedule
            </button>
          </header>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Original principal
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(selectedLoan.principal, selectedLoan.currency, displayCurrency),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Monthly payment
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      calcMonthlyEmi(
                        selectedLoan.principal,
                        selectedLoan.annualInterestRate,
                        selectedLoan.termMonths,
                      ),
                      selectedLoan.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Outstanding balance
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {formatMoney(
                    convertCurrency(
                      getLoanRemainingBalance(selectedLoan),
                      selectedLoan.currency,
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {repaymentProgress.paidCount} of {schedule.length} installments paid
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {repaymentProgress.nextPayment
                    ? `Next payment ${formatDateOnly(repaymentProgress.nextPayment.dueDate)}`
                    : "All installments paid"}
                </div>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                role="progressbar"
                aria-label="Repayment progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={repaymentProgress.percent}
              >
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${repaymentProgress.percent}%` }}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[760px] text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <tr>
                    <th className="w-20 px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      Installment
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      Due date
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      Payment
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {schedule.map((row) => {
                    const repayment = selectedLoan.repayments?.find(
                      (item) => item.paymentNumber === row.paymentNumber,
                    );
                    const isPaid = repayment?.paid ?? false;
                    const isOverdue = !isPaid && row.dueDate < todayIso;

                    return (
                      <tr
                        key={row.paymentNumber}
                        className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {row.paymentNumber}
                        </td>
                        <td className="px-4 py-3">{formatDateOnly(row.dueDate)}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(
                            convertCurrency(
                              row.paymentAmount,
                              selectedLoan.currency,
                              displayCurrency,
                            ),
                            displayCurrency,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              isOverdue
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : isPaid
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {isOverdue ? "Overdue" : isPaid ? "Paid" : "Upcoming"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedRepaymentNumber(row.paymentNumber)}
                              className="rounded-md px-2 py-1.5 text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-slate-700"
                            >
                              Details
                            </button>
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => openPaidDialog(row.paymentNumber)}
                                className="rounded-md bg-emerald-600/10 px-2 py-1.5 font-medium text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-300"
                              >
                                Mark paid
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRepaymentNumber(row.paymentNumber);
                                startRepaymentEdit(row.paymentNumber, repayment);
                              }}
                              className="rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
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
