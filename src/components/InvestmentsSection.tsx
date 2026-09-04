import { useMemo, useState } from "react";
import { Pencil, Plus, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FundClassification, Investment, InvestmentSubtype } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchInvestments } from "../services/backend.service";
import { deleteInvestment } from "../services/backendSync";
import showConfirm from "./Confirm";
import AddInvestmentModal from "./modals/AddInvestmentModal";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { INVESTMENT_TYPE_ICONS } from "../utils/typeIcons";
import { inferFundClassification } from "../utils/fundClassification";
const typeLabels: Record<Investment["type"], string> = {
  equity: "Equity",
  "mutual-fund": "Mutual Fund",
  etf: "ETF",
  bond: "Bond",
  retirement: "Retirement savings",
  other: "Other",
};
const subtypeLabels: Record<InvestmentSubtype, string> = {
  equity: "Equity",
  debt: "Debt",
  index: "Index",
  hybrid: "Hybrid",
  "solution-oriented": "Solution-oriented",
  pf: "PF",
  vpf: "VPF",
  nps: "NPS",
  other: "Other",
};
const classificationLabels: Record<FundClassification, string> = {
  "large-cap": "Large cap",
  "mid-cap": "Mid cap",
  "small-cap": "Small cap",
  "flexi-cap": "Flexi cap",
  "multi-cap": "Multi cap",
  other: "Other",
};
export default function InvestmentsSection() {
  const displayCurrency = useDisplayCurrency();
  const investments = useBackendResource(() => fetchInvestments(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | undefined>();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Investment["type"] | "all">("all");
  const [subtypeFilter, setSubtypeFilter] = useState<InvestmentSubtype | "all">("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [gainSort, setGainSort] = useState<"none" | "asc" | "desc">("none");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const platforms = useMemo(
    () =>
      [...new Set((investments ?? []).map((investment) => investment.platform))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [investments],
  );
  const filteredInvestments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = (investments ?? []).filter((investment) => {
      const matchesSearch =
        !query ||
        investment.name.toLowerCase().includes(query) ||
        investment.platform.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || investment.type === typeFilter;
      const matchesSubtype = subtypeFilter === "all" || investment.subtype === subtypeFilter;
      const matchesPlatform = platformFilter === "all" || investment.platform === platformFilter;
      return matchesSearch && matchesType && matchesSubtype && matchesPlatform;
    });
    if (gainSort === "none") return rows;
    return [...rows].sort((left, right) => {
      const leftGain =
        convertCurrency(left.currentValue, left.currency, displayCurrency) -
        convertCurrency(left.investedAmount, left.currency, displayCurrency);
      const rightGain =
        convertCurrency(right.currentValue, right.currency, displayCurrency) -
        convertCurrency(right.investedAmount, right.currency, displayCurrency);
      return gainSort === "asc" ? leftGain - rightGain : rightGain - leftGain;
    });
  }, [investments, search, typeFilter, subtypeFilter, platformFilter, gainSort, displayCurrency]);
  const subtypeTotals = useMemo(() => {
    const totals = new Map<InvestmentSubtype, number>();
    for (const investment of filteredInvestments) {
      if (!investment.subtype) continue;
      totals.set(
        investment.subtype,
        (totals.get(investment.subtype) ?? 0) +
          convertCurrency(investment.currentValue, investment.currency, displayCurrency),
      );
    }
    return [...totals.entries()];
  }, [filteredInvestments, displayCurrency]);
  const mutualFundSubtypeTotals = useMemo(() => {
    const totals = new Map<InvestmentSubtype, number>();
    for (const investment of filteredInvestments) {
      if (investment.type !== "mutual-fund" || !investment.subtype) continue;
      totals.set(
        investment.subtype,
        (totals.get(investment.subtype) ?? 0) +
          convertCurrency(investment.currentValue, investment.currency, displayCurrency),
      );
    }
    return [...totals.entries()].map(([subtype, value]) => ({
      subtype: subtypeLabels[subtype],
      value,
    }));
  }, [filteredInvestments, displayCurrency]);
  const classificationTotals = useMemo(() => {
    const totals = new Map<FundClassification, number>();
    for (const investment of filteredInvestments) {
      if (investment.type !== "mutual-fund" && investment.type !== "equity") continue;
      const classification =
        investment.classification && investment.classification !== "other"
          ? investment.classification
          : (inferFundClassification(investment.name) ?? "other");
      totals.set(
        classification,
        (totals.get(classification) ?? 0) +
          convertCurrency(investment.currentValue, investment.currency, displayCurrency),
      );
    }
    return [...totals.entries()];
  }, [filteredInvestments, displayCurrency]);
  const totalPages = Math.max(1, Math.ceil(filteredInvestments.length / pageSize));
  const visibleInvestments = filteredInvestments.slice((page - 1) * pageSize, page * pageSize);
  const totals = useMemo(() => {
    const rows = investments ?? [];
    const invested = rows.reduce(
      (sum, item) => sum + convertCurrency(item.investedAmount, item.currency, displayCurrency),
      0,
    );
    const current = rows.reduce(
      (sum, item) => sum + convertCurrency(item.currentValue, item.currency, displayCurrency),
      0,
    );
    return { invested, current, gain: current - invested };
  }, [investments, displayCurrency]);
  const openCreateModal = () => {
    setSelectedInvestment(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setIsModalOpen(true);
  };
  const handleDelete = async (investment: Investment) => {
    if (!investment.id) return;
    const ok = await showConfirm(`Delete the investment "${investment.name}"?`, {
      title: "Delete investment",
      confirmText: "Delete",
    });
    if (ok) await deleteInvestment(investment.id);
  };
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5">
      {" "}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {" "}
        <div>
          {" "}
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
            {" "}
            Investments{" "}
          </div>{" "}
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {" "}
            Equity, mutual funds, and more{" "}
          </h2>{" "}
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {" "}
            Track holdings across Zerodha, 5Paisa, and other platforms.{" "}
          </p>{" "}
        </div>{" "}
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          {" "}
          <Plus className="h-4 w-4" /> Add investment{" "}
        </button>{" "}
      </div>{" "}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search investments or platforms"
          aria-label="Search investments or platforms"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as Investment["type"] | "all")}
          aria-label="Filter by investment type"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(event) => setPlatformFilter(event.target.value)}
          aria-label="Filter by platform"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All platforms</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
        <select
          value={subtypeFilter}
          onChange={(event) => setSubtypeFilter(event.target.value as InvestmentSubtype | "all")}
          aria-label="Filter by investment subtype"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All subtypes</option>
          {Object.entries(subtypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={gainSort}
          onChange={(event) => setGainSort(event.target.value as typeof gainSort)}
          aria-label="Sort by gain"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="none">Default order</option>
          <option value="desc">Gain: highest first</option>
          <option value="asc">Gain: lowest first</option>
        </select>
      </div>{" "}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {" "}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-3">
          {" "}
          <div className="text-sm text-slate-600 dark:text-slate-400">Invested</div>{" "}
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            {formatMoney(totals.invested, displayCurrency)}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-3">
          {" "}
          <div className="text-sm text-slate-600 dark:text-slate-400">Current value</div>{" "}
          <div className="mt-1 text-lg font-semibold text-cyan-600 dark:text-cyan-400">
            {" "}
            {formatMoney(totals.current, displayCurrency)}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-3">
          {" "}
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            {" "}
            {totals.gain >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            )}{" "}
            Gain / loss{" "}
          </div>{" "}
          <div
            className={`mt-1 text-lg font-semibold ${totals.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {" "}
            {formatMoney(totals.gain, displayCurrency)}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {subtypeTotals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Current value by investment subtype">
          {subtypeTotals.map(([subtype, value]) => (
            <div
              key={subtype}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs dark:border-cyan-900/60 dark:bg-cyan-950/30"
            >
              <span className="text-slate-600 dark:text-slate-400">{subtypeLabels[subtype]}</span>
              <span className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(value, displayCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}{" "}
      {classificationTotals.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Current value by fund classification"
        >
          {classificationTotals.map(([classification, value]) => (
            <div
              key={classification}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30"
            >
              <span className="text-slate-600 dark:text-slate-400">
                {classificationLabels[classification]}
              </span>
              <span className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(value, displayCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}{" "}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Mutual-fund allocation
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Current value by fund subtype
            </p>
          </div>
          <span className="text-xs text-slate-500">{displayCurrency}</span>
        </div>
        {mutualFundSubtypeTotals.length > 0 ? (
          <div className="mt-4 h-56" aria-label="Mutual-fund current value by subtype">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mutualFundSubtypeTotals}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tickFormatter={(value) => formatMoney(Number(value), displayCurrency)}
                />
                <YAxis
                  type="category"
                  dataKey="subtype"
                  width={92}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(14, 165, 233, 0.08)" }}
                  formatter={(value) => formatMoney(Number(value), displayCurrency)}
                />
                <Bar dataKey="value" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Add a mutual fund with a subtype to see its allocation here.
          </div>
        )}
      </div>{" "}
      {filteredInvestments.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          {" "}
          <table className="w-full min-w-[760px] text-left text-sm text-slate-700 dark:text-slate-300">
            {" "}
            <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              {" "}
              <tr>
                {" "}
                <th className="px-4 py-3 font-medium">Investment</th>{" "}
                <th className="px-4 py-3 font-medium">Platform</th>{" "}
                <th className="px-4 py-3 font-medium">Type</th>{" "}
                <th className="px-4 py-3 font-medium text-right">Units</th>{" "}
                <th className="px-4 py-3 font-medium text-right"> Current value </th>{" "}
                <th className="px-4 py-3 font-medium">Updated</th>{" "}
                <th className="px-4 py-3 text-right font-medium">Actions</th>{" "}
              </tr>{" "}
            </thead>{" "}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {" "}
              {visibleInvestments.map((investment) => {
                const investedConverted = convertCurrency(
                  investment.investedAmount,
                  investment.currency,
                  displayCurrency,
                );
                const currentConverted = convertCurrency(
                  investment.currentValue,
                  investment.currency,
                  displayCurrency,
                );
                const gain = currentConverted - investedConverted;
                return (
                  <tr key={investment.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/20">
                    {" "}
                    <td className="px-4 py-3">
                      {" "}
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {" "}
                        {investment.name}{" "}
                      </div>{" "}
                      {investment.note && (
                        <div className="mt-0.5 text-xs text-slate-500"> {investment.note} </div>
                      )}{" "}
                    </td>{" "}
                    <td className="px-4 py-3">{investment.platform}</td>{" "}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {(() => {
                          const Icon = INVESTMENT_TYPE_ICONS[investment.type];
                          return <Icon className="h-4 w-4 text-cyan-500" aria-hidden="true" />;
                        })()}
                        {typeLabels[investment.type]}
                      </span>
                      {investment.subtype && (
                        <div className="text-xs text-slate-500">
                          {subtypeLabels[investment.subtype]}
                        </div>
                      )}
                      {(investment.classification || inferFundClassification(investment.name)) && (
                        <div className="text-xs text-slate-500">
                          {
                            classificationLabels[
                              investment.classification && investment.classification !== "other"
                                ? investment.classification
                                : (inferFundClassification(investment.name) ?? "other")
                            ]
                          }
                        </div>
                      )}
                    </td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      {investment.quantity.toLocaleString("en-IN")}{" "}
                    </td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {" "}
                        {formatMoney(currentConverted, displayCurrency)}{" "}
                      </div>{" "}
                      <div
                        className={
                          gain >= 0
                            ? "text-xs text-emerald-600 dark:text-emerald-400"
                            : "text-xs text-rose-600 dark:text-rose-400"
                        }
                      >
                        {" "}
                        {gain >= 0 ? "+" : ""} {formatMoney(gain, displayCurrency)}{" "}
                        <div className="text-xs text-slate-500">
                          {investedConverted !== 0
                            ? `${((gain / investedConverted) * 100).toFixed(2)}% gain`
                            : "Gain n/a"}
                        </div>
                      </div>{" "}
                    </td>{" "}
                    <td className="px-4 py-3">{investment.purchaseDate}</td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      <button
                        type="button"
                        onClick={() => openEditModal(investment)}
                        className="mr-2 rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        title="Edit investment"
                      >
                        {" "}
                        <Pencil className="h-4 w-4" />{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => handleDelete(investment)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                        title="Delete investment"
                      >
                        {" "}
                        <Trash2 className="h-4 w-4" />{" "}
                      </button>{" "}
                    </td>{" "}
                  </tr>
                );
              })}{" "}
            </tbody>{" "}
          </table>{" "}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {investments && investments.length > 0
            ? "No investments match the selected filters."
            : "No investments recorded yet. Add your first holding to start tracking your portfolio."}
        </div>
      )}{" "}
      {filteredInvestments.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, filteredInvestments.length)} of {filteredInvestments.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}{" "}
      <AddInvestmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInvestment(undefined);
        }}
        initialInvestment={selectedInvestment}
      />{" "}
    </section>
  );
}
