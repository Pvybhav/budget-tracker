import mongoose from "mongoose";

const { Schema, model } = mongoose;

const cardSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["credit", "debit", "meal", "wallet", "other"],
      default: "credit",
    },
    billingDate: Number,
    paymentDate: Number,
    totalLimit: { type: Number, required: true },
    amc: Number,
    waiveOffLimit: Number,
    linkedCardIds: [Number],
  },
  { timestamps: true },
);

const categorySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: String,
    budgetAmount: Number,
    budgetMode: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
  },
  { timestamps: true },
);

const expenseSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    cardId: { type: Number, required: true },
    categoryId: Number,
    details: String,
    amount: { type: Number, required: true },
    date: { type: String, required: true },
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

export const Card = model("Card", cardSchema);
export const Category = model("Category", categorySchema);
export const Expense = model("Expense", expenseSchema);
export const Payment = model("Payment", paymentSchema);
export const Loan = model("Loan", loanSchema);
export const SavingsGoal = model("SavingsGoal", savingsGoalSchema);
