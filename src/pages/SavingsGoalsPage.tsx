import SavingsGoalsSection from "../components/SavingsGoalsSection";

export default function SavingsGoalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-100">Savings Goals</h1>
        <p className="mt-2 text-sm text-slate-400">
          Plan for major purchases with a target amount, deadline, and
          progress-based ETA.
        </p>
      </div>

      <SavingsGoalsSection />
    </div>
  );
}
