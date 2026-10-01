import type { Category } from "../db/db";

export const CATEGORY_ACCENTS = [
  {
    border: "border-l-emerald-500",
    icon: "bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300",
    badge:
      "bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/50",
  },
  {
    border: "border-l-sky-500",
    icon: "bg-sky-500/15 border-sky-500/35 text-sky-700 dark:text-sky-300",
    badge:
      "bg-sky-500/15 border-sky-500/35 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 hover:border-sky-400/50",
  },
  {
    border: "border-l-amber-500",
    icon: "bg-amber-500/15 border-amber-500/35 text-amber-700 dark:text-amber-300",
    badge:
      "bg-amber-500/15 border-amber-500/35 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50",
  },
  {
    border: "border-l-rose-500",
    icon: "bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-300",
    badge:
      "bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 hover:border-rose-400/50",
  },
  {
    border: "border-l-violet-500",
    icon: "bg-violet-500/15 border-violet-500/35 text-violet-700 dark:text-violet-300",
    badge:
      "bg-violet-500/15 border-violet-500/35 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25 hover:border-violet-400/50",
  },
  {
    border: "border-l-cyan-500",
    icon: "bg-cyan-500/15 border-cyan-500/35 text-cyan-700 dark:text-cyan-300",
    badge:
      "bg-cyan-500/15 border-cyan-500/35 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/50",
  },
] as const;

export function getCategoryAccent(category: Pick<Category, "id" | "title">) {
  const key = `${category.id ?? ""}-${category.title}`;
  const hash = Array.from(key).reduce(
    (total, character) => total + (character.codePointAt(0) ?? 0),
    0,
  );
  return CATEGORY_ACCENTS[hash % CATEGORY_ACCENTS.length];
}
