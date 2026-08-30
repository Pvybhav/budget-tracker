import mongoose from "mongoose";
const { Schema, model } = mongoose;
const cardSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["credit", "debit", "bank", "meal", "wallet", "cash", "gift", "other"],
      default: "credit",
    },
    billingDate: Number,
    paymentDate: Number,
    totalLimit: { type: Number, required: true },
    amc: Number,
    waiveOffLimit: Number,
    linkedCardIds: [Number],
    bankName: String,
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
  },
  { timestamps: true },
);
const categorySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: String,
    budgetAmount: Number,
    budgetMode: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
  },
  { timestamps: true },
);
const expenseSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    cardId: { type: Number, required: true },
    categoryId: Number,
    details: String,
    tags: { type: [String], default: [] },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    reconciled: { type: Boolean, default: false },
    isEmi: Boolean,
    emiMonths: Number,
    emiInterestRate: Number,
    emiProcessingFee: Number,
    emiGst: Number,
    recurringFrequency: { type: String, enum: ["monthly", "weekly", "yearly"] },
    recurringInterval: Number,
    recurringEndDate: String,
    recurringTemplateId: Number,
    isRecurringInstance: Boolean,
  },
  { timestamps: true },
);
const paymentSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    cardId: { type: Number, required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true },
);
const transferSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    fromAccountId: { type: Number, required: true },
    toAccountId: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true },
    note: String,
  },
  { timestamps: true },
);
const billSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["mobile", "internet", "postpaid", "electricity", "water", "gas", "other"],
      default: "other",
    },
    provider: String,
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: String, required: true },
    paid: { type: Boolean, default: false },
    note: String,
    isSubscription: { type: Boolean, default: false },
    subscriptionFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"] },
  },
  { timestamps: true },
);
const loanSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    lender: { type: String, required: true },
    principal: { type: Number, required: true },
    annualInterestRate: { type: Number, required: true },
    termMonths: { type: Number, required: true },
    startDate: { type: String, required: true },
    note: String,
    createdAt: { type: String, required: true },
    repayments: {
      type: [
        {
          paymentNumber: { type: Number, required: true },
          paid: { type: Boolean, required: true },
          paidDate: String,
          note: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);
const incomeSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    source: { type: String, required: true },
    category: {
      type: String,
      enum: ["salary", "freelance", "business", "interest", "dividend", "refund", "gift", "other"],
      default: "other",
    },
    accountId: Number,
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    note: String,
    recurringFrequency: { type: String, enum: ["monthly", "weekly", "yearly"] },
    recurringInterval: Number,
    recurringEndDate: String,
    recurringTemplateId: Number,
    isRecurringInstance: Boolean,
  },
  { timestamps: true },
);
const savingsGoalSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    targetDate: { type: String, required: true },
    currentAmount: { type: Number, required: true },
    createdAt: { type: String, required: true },
    note: String,
  },
  { timestamps: true },
);
const rewardPointsSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    cardId: { type: Number, required: true },
    type: { type: String, enum: ["earned", "redeemed", "expired"], required: true },
    points: { type: Number, required: true },
    valuePerPoint: Number,
    date: { type: String, required: true },
    expiryDate: String,
    note: String,
  },
  { timestamps: true },
);
const investmentSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    platform: { type: String, required: true },
    type: { type: String, enum: ["equity", "mutual-fund", "etf", "bond", "other"], required: true },
    quantity: { type: Number, required: true, min: 0 },
    investedAmount: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },
    purchaseDate: { type: String, required: true },
    note: String,
  },
  { timestamps: true },
);
const investmentTransactionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    investmentId: { type: Number, required: true },
    type: { type: String, enum: ["buy", "sell", "dividend", "fee"], required: true },
    quantity: { type: Number, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    note: String,
  },
  { timestamps: true },
);
const insurancePolicySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    policyName: { type: String, required: true },
    type: {
      type: String,
      enum: ["health", "life", "term", "vehicle", "home", "other"],
      default: "other",
    },
    provider: { type: String, required: true },
    policyNumber: String,
    sumAssured: { type: Number, required: true },
    premiumAmount: { type: Number, required: true },
    premiumFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "half-yearly", "yearly"],
      default: "yearly",
    },
    startDate: { type: String, required: true },
    endDate: String,
    note: String,
    createdAt: { type: String, required: true },
    premiumPayments: {
      type: [
        {
          id: Number,
          date: { type: String, required: true },
          amount: { type: Number, required: true },
          note: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    fullName: { type: String, trim: true, default: "User" },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true },
);
const budgetRuleSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    type: { type: String, enum: ["category", "card"], required: true },
    targetId: { type: Number, required: true },
    thresholdAmount: { type: Number, required: true },
    period: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
    enabled: { type: Boolean, default: true },
    note: String,
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);
const autoCategorizeRuleSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    keyword: { type: String, required: true },
    categoryId: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);
const netWorthSnapshotSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    date: { type: String, required: true, unique: true },
    assets: { type: Number, required: true },
    liabilities: { type: Number, required: true },
    netWorth: { type: Number, required: true },
  },
  { timestamps: true },
);
export const User = model("User", userSchema);
export const Card = model("Card", cardSchema);
export const Category = model("Category", categorySchema);
export const Expense = model("Expense", expenseSchema);
export const Payment = model("Payment", paymentSchema);
export const Transfer = model("Transfer", transferSchema);
export const Bill = model("Bill", billSchema);
export const Loan = model("Loan", loanSchema);
export const SavingsGoal = model("SavingsGoal", savingsGoalSchema);
export const Income = model("Income", incomeSchema);
export const RewardPoints = model("RewardPoints", rewardPointsSchema);
export const Investment = model("Investment", investmentSchema);
export const InvestmentTransaction = model("InvestmentTransaction", investmentTransactionSchema);
export const InsurancePolicy = model("InsurancePolicy", insurancePolicySchema);
export const BudgetRule = model("BudgetRule", budgetRuleSchema);
export const AutoCategorizeRule = model("AutoCategorizeRule", autoCategorizeRuleSchema);
export const NetWorthSnapshot = model("NetWorthSnapshot", netWorthSnapshotSchema);
