import { formatConverted, useDisplayCurrency } from "../services/currency.service";

interface Props {
  amount: number;
  currency?: string;
  className?: string;
}

// Renders `amount` (stored in its own `currency`) converted into the user's chosen display
// currency (see currency.service.ts / Layout's currency picker). Use this instead of ad-hoc
// toLocaleString/formatCurrency calls so every amount in the app respects the display currency.
export default function Money({ amount, currency, className }: Props) {
  const displayCurrency = useDisplayCurrency();
  return <span className={className}>{formatConverted(amount, currency, displayCurrency)}</span>;
}
