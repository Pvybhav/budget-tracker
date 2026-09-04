import RewardPointsSection from "../components/RewardPointsSection";

export default function RewardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Rewards</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Track earned points, redemptions, expiries, and their cash value across your accounts.
        </p>
      </div>
      <RewardPointsSection />
    </div>
  );
}
