import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  Car,
  CreditCard,
  Droplets,
  FileHeart,
  Flame,
  Gift,
  HeartPulse,
  Landmark,
  Lightbulb,
  LockKeyhole,
  Network,
  Package,
  Phone,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AccountType, BillType, CardIconKey, InsuranceType, InvestmentType } from "../db/db";

export const BILL_TYPE_ICONS: Record<BillType, LucideIcon> = {
  mobile: Smartphone,
  internet: Network,
  postpaid: Phone,
  electricity: Lightbulb,
  water: Droplets,
  gas: Flame,
  other: Receipt,
};

export const INSURANCE_TYPE_ICONS: Record<InsuranceType, LucideIcon> = {
  health: HeartPulse,
  life: ShieldCheck,
  term: LockKeyhole,
  vehicle: Car,
  home: Building2,
  other: FileHeart,
};

export const INVESTMENT_TYPE_ICONS: Record<InvestmentType, LucideIcon> = {
  equity: TrendingUp,
  "mutual-fund": Network,
  etf: Package,
  bond: Landmark,
  retirement: PiggyBank,
  other: Receipt,
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  credit: CreditCard,
  debit: Wallet,
  bank: Landmark,
  meal: Receipt,
  wallet: Smartphone,
  cash: Banknote,
  gift: Gift,
  other: Wallet,
};

export const CARD_ICONS: Record<CardIconKey, LucideIcon> = {
  "credit-card": CreditCard,
  wallet: Wallet,
  bank: Landmark,
  smartphone: Smartphone,
  cash: Banknote,
  gift: Gift,
  building: Building2,
  package: Package,
};

export const CARD_ICON_OPTIONS: { value: CardIconKey; label: string }[] = [
  { value: "credit-card", label: "Credit card" },
  { value: "wallet", label: "Wallet" },
  { value: "bank", label: "Bank" },
  { value: "smartphone", label: "Mobile" },
  { value: "cash", label: "Cash" },
  { value: "gift", label: "Gift" },
  { value: "building", label: "Building" },
  { value: "package", label: "Package" },
];
