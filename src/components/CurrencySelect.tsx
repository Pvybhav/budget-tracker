import { SUPPORTED_CURRENCIES } from "../services/currency.service";

interface Props {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}

// Compact currency-code dropdown reused across every Add*Modal that has a money field.
export default function CurrencySelect({ value, onChange, className, id, disabled }: Props) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "px-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      }
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} ({c.symbol})
        </option>
      ))}
    </select>
  );
}
