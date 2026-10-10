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
        "w-32 min-w-0 shrink-0 appearance-none bg-white bg-[right_0.55rem_center] bg-no-repeat px-2 py-2 pr-7 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      }
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} ({c.symbol})
        </option>
      ))}
    </select>
  );
}
