import {
  BookOpen,
  Car,
  Film,
  Heart,
  House,
  Plane,
  Receipt,
  Shield,
  ShoppingBag,
  Tags,
  Utensils,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/food|dining|restaurant|grocery/i, Utensils],
  [/transport|travel|car|fuel/i, Car],
  [/home|house|rent|housing/i, House],
  [/health|medical|fitness|gym/i, Heart],
  [/education|book|course/i, BookOpen],
  [/entertainment|movie|music/i, Film],
  [/shopping|clothing|fashion/i, ShoppingBag],
  [/utility|electric|power/i, Zap],
  [/flight|airfare|trip/i, Plane],
  [/insurance/i, Shield],
  [/bill|subscription/i, Receipt],
];

export function getCategoryIcon(title: string): LucideIcon {
  return CATEGORY_ICONS.find(([pattern]) => pattern.test(title))?.[1] ?? Tags;
}