import { useState } from "react";

export type SortDirection = "asc" | "desc";

export function useTableSort<T>(initialKey: string, initialDirection: SortDirection = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);
  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  };
  const setSort = (key: string, sortDirection: SortDirection = "asc") => {
    setSortKey(key);
    setDirection(sortDirection);
  };
  const sortRows = (rows: T[], accessors: Record<string, (row: T) => unknown>) => {
    const accessor = accessors[sortKey];
    if (!accessor) return rows;
    return [...rows].sort((left, right) => {
      const leftValue = accessor(left);
      const rightValue = accessor(right);
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return direction === "asc" ? result : -result;
    });
  };
  return { sortKey, direction, toggleSort, setSort, sortRows };
}
