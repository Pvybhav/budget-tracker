import InvestmentsSection from "../components/InvestmentsSection";
import InvestmentTransactionsSection from "../components/InvestmentTransactionsSection";
export default function InvestmentsPage() {
  return (
    <div className="space-y-6">
      {" "}
      <div>
        {" "}
        <h1 className="text-3xl font-semibold text-slate-100">Investments</h1>{" "}
        <p className="mt-2 text-sm text-slate-400">
          {" "}
          Keep a manual portfolio snapshot across all your investment platforms.{" "}
        </p>{" "}
      </div>{" "}
      <InvestmentsSection /> <InvestmentTransactionsSection />{" "}
    </div>
  );
}
