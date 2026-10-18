import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "./useTableSort";

type Props = {
  label: string;
  sortKey: string;
  activeKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
};

export default function SortableTableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
}: Readonly<Props>) {
  const active = sortKey === activeKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left hover:text-slate-950 dark:hover:text-white"
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </button>
    </th>
  );
}
