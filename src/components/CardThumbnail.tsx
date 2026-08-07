import { useState } from "react";
import { type Card, db } from "../db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { CreditCard, CalendarDays, AlertCircle, Zap } from "lucide-react";
import { getCardMetrics } from "../services/card.service";

import sbiLogo from "../assets/banks/sbi.svg";
import iciciLogo from "../assets/banks/icici.png";
import hdfcLogo from "../assets/banks/hdfc.png";

const BANK_LOGOS: Record<string, string> = {
  sbi: sbiLogo,
  icici: iciciLogo,
  hdfc: hdfcLogo,
};

function getBankLogo(title: string) {
  const lowerTitle = title.toLowerCase();
  for (const [key, logo] of Object.entries(BANK_LOGOS)) {
    if (lowerTitle.includes(key)) {
      return logo;
    }
  }
  return null;
}

export default function CardThumbnail({ card }: { card: Card }) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Fetch expenses to determine AMC condition and current limits dynamically
  const expenses = useLiveQuery(() =>
    db.expenses.where("cardId").equals(card.id!).toArray(),
  );

  const payments = useLiveQuery(() =>
    db.payments.where("cardId").equals(card.id!).toArray(),
  );

  // Fallbacks while loading
  if (!expenses || !payments)
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse aspect-[1.586/1]"></div>
    );

  const metrics = getCardMetrics(card, expenses, payments);
  const {
    amountToPayNext,
    availableLimit,
    nextBillDate,
    nextPayDate,
    amcMessageText,
    isAmcWaived,
  } = metrics;

  let amcColorClass = "";
  let AmcIcon = null;
  if (amcMessageText) {
    if (isAmcWaived) {
      amcColorClass = "text-emerald-400";
      AmcIcon = Zap;
    } else {
      amcColorClass = "text-red-400";
      AmcIcon = AlertCircle;
    }
  }

  const logo = getBankLogo(card.title);
  const accountTypeLabel =
    card.type === "debit"
      ? "Debit Card"
      : card.type === "meal"
        ? "Meal Card"
        : card.type === "wallet"
          ? "UPI Wallet"
          : card.type === "other"
            ? "Account"
            : "Credit Card";

  return (
    <div
      className="w-full aspect-[1.586/1] [perspective:1000px] cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`w-full h-full transition-transform duration-700 [transform-style:preserve-3d] relative ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 w-full h-full p-5 md:p-6 bg-gradient-to-tr from-slate-900/80 via-slate-800/60 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-[1.25rem] shadow-2xl flex flex-col justify-between hover:border-white/20 transition-colors overflow-hidden [backface-visibility:hidden]">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-400/30 transition-all pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex flex-col">
              <h3 className="text-xl font-bold tracking-widest text-slate-100 uppercase drop-shadow-md">
                {card.title}
              </h3>
              <p className="text-[10px] text-slate-400/80 mt-1 mb-1 uppercase tracking-widest">
                {accountTypeLabel}
              </p>
              {amcMessageText && AmcIcon && (
                <p
                  className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${amcColorClass}`}
                >
                  <AmcIcon className="w-3 h-3" />
                  {amcMessageText}
                </p>
              )}
            </div>
            <div className="p-2 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center min-w-[3.5rem] min-h-[3.5rem] border border-white/10 shadow-lg">
              {logo ? (
                <img
                  src={logo}
                  alt={`${card.title} logo`}
                  className="w-10 object-contain drop-shadow-lg"
                />
              ) : (
                <CreditCard className="w-7 h-7 text-slate-300 opacity-80" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3 relative z-10 w-full mt-auto">
            <div className="bg-black/20 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                {card.type === "credit" ? "Available Limit" : "Balance"}
              </p>
              <p className="text-lg font-medium text-emerald-400 tracking-wide drop-shadow-sm truncate">
                ₹{availableLimit}
              </p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                {card.type === "credit" ? "Amount to Pay" : "Pending"}
              </p>
              <p className="text-lg font-medium text-slate-300 tracking-wide drop-shadow-sm truncate">
                ₹{amountToPayNext}
              </p>
            </div>
          </div>

          <p className="flex justify-between items-center text-[10px] uppercase tracking-wide text-slate-400/80 mt-1">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3" />
              {card.type === "credit" ? "Next Bill:" : "Updated:"}
              <span className="font-semibold text-slate-200">
                {nextBillDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              {card.type === "credit" ? "Due:" : "Status:"}
              <span className="font-semibold text-slate-200">
                {card.type === "credit"
                  ? nextPayDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Active"}
              </span>
            </span>
          </p>
        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full p-6 bg-slate-900 border border-slate-700/50 rounded-[1.25rem] shadow-2xl flex flex-col [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-y-auto">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">
            Card Properties
          </h4>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Total Limit</span>
              <span className="text-slate-200 font-medium tracking-wide">
                ₹{card.totalLimit}
              </span>
            </div>
            {card.type === "credit" && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Billing Date</span>
                  <span className="text-slate-200 font-medium">
                    Every {card.billingDate ?? "—"}
                    {card.billingDate
                      ? ["st", "nd", "rd"][(card.billingDate % 10) - 1] || "th"
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Payment Date</span>
                  <span className="text-slate-200 font-medium">
                    Every {card.paymentDate ?? "—"}
                    {card.paymentDate
                      ? ["st", "nd", "rd"][(card.paymentDate % 10) - 1] || "th"
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">AMC</span>
                  <span className="text-slate-200 font-medium tracking-wide">
                    ₹{card.amc ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">
                    Waive Off Limit
                  </span>
                  <span className="text-slate-200 font-medium tracking-wide">
                    ₹{card.waiveOffLimit ?? 0}
                  </span>
                </div>
              </>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest border-t border-slate-800 pt-3">
            Click to Flip Back
          </p>
        </div>
      </div>
    </div>
  );
}
