import mongoose from "mongoose";
const { Schema, model } = mongoose;
const { ObjectId, Decimal128 } = Schema.Types;
// Converts any Decimal128 value (top-level or inside array subdocuments) back to a plain JS
// number so the wire API shape stays a number, even though money is stored as Decimal128.
function decimalToNumber(value) {
  if (value != null && typeof value === "object" && value._bsontype === "Decimal128") {
    return parseFloat(value.toString());
  }
  return value;
}
// Applied to every top-level model schema: serializes Mongo's native `_id` as a string `id` field
// (mirroring the old numeric `id` API shape), drops internal `_id`/`__v`, and coerces any
// Decimal128 money fields (including inside subdocument arrays) back to plain numbers.
function withIdTransform(schema) {
  schema.set("toJSON", {
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      for (const key of Object.keys(ret)) {
        const value = ret[key];
        if (Array.isArray(value)) {
          ret[key] = value.map((item) => {
            if (item && typeof item === "object") {
              for (const k of Object.keys(item)) item[k] = decimalToNumber(item[k]);
            }
            return item;
          });
        } else {
          ret[key] = decimalToNumber(value);
        }
      }
      return ret;
    },
  });
  return schema;
}
// Accepts "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm[:ss[.SSS]][Z]" - the formats used by the UI's date/datetime-local inputs.
const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?Z?)?$/;
// Normalizes date-ish input to a native Date, always interpreted as UTC even for the bare
// "YYYY-MM-DDTHH:mm" datetime-local strings the UI sends with no timezone suffix - avoids a
// server/browser-local-timezone mismatch silently shifting the stored calendar date/time.
function toUTCDate(value) {
  if (value == null || value === "") return value;
  if (value instanceof Date) return value;
  const str = String(value);
  if (!DATE_STRING_PATTERN.test(str)) return new Date(str);
  const hasTimezone = /Z$/.test(str);
  const hasTime = /T\d{2}:\d{2}/.test(str);
  if (hasTimezone) return new Date(str);
  return new Date(hasTime ? `${str}Z` : `${str}T00:00:00.000Z`);
}
const validDate = {
  validator: (value) => value == null || !Number.isNaN(value.getTime()),
  message: (props) => `${props.value} is not a valid date`,
};
// Rounds money to 2 decimals and stores it as Decimal128 for exact decimal arithmetic (no
// binary-float drift); withIdTransform() converts it back to a plain number on the way out.
function toMoney(value) {
  if (value == null || value === "") return value;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return value;
  return mongoose.Types.Decimal128.fromString(num.toFixed(2));
}
// Decimal128 doesn't support the built-in Number `min`/`max` SchemaType validators, so this
// re-implements a minimum-value check for money fields.
const decimalMin = (min) => ({
  validator: (value) => value == null || parseFloat(value.toString()) >= min,
  message: (props) => `${props.path} must be at least ${min}`,
});
// Optional now (defaults to INR) so existing single-currency documents stay valid; lets multi-currency
// support be added later without a required-field migration like the userId retrofit needed.
const currencyField = {
  type: String,
  default: "INR",
  trim: true,
  uppercase: true,
  minlength: 3,
  maxlength: 3,
};
const cardSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["credit", "debit", "bank", "meal", "wallet", "cash", "gift", "other"],
      default: "credit",
    },
    icon: {
      type: String,
      enum: ["credit-card", "wallet", "bank", "smartphone", "cash", "gift", "building", "package"],
    },
    billingDate: Number,
    paymentDate: Number,
    totalLimit: { type: Decimal128, required: true, set: toMoney },
    amc: { type: Decimal128, set: toMoney },
    waiveOffLimit: { type: Decimal128, set: toMoney },
    linkedCardIds: [{ type: ObjectId, ref: "Card" }],
    bankName: String,
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const categorySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: String,
    budgetAmount: { type: Decimal128, set: toMoney },
    budgetMode: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
  },
  { timestamps: true },
);
const expenseSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    cardId: { type: ObjectId, ref: "Card", required: true },
    categoryId: { type: ObjectId, ref: "Category" },
    details: String,
    tags: { type: [String], default: [] },
    amount: { type: Decimal128, required: true, set: toMoney },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    reconciled: { type: Boolean, default: false },
    isEmi: Boolean,
    emiMonths: Number,
    emiInterestRate: Number,
    emiProcessingFee: Number,
    emiGst: Number,
    recurringFrequency: { type: String, enum: ["monthly", "weekly", "yearly"] },
    recurringInterval: Number,
    recurringEndDate: { type: Date, set: toUTCDate, validate: validDate },
    recurringTemplateId: { type: ObjectId, ref: "Expense" },
    isRecurringInstance: Boolean,
    currency: currencyField,
  },
  { timestamps: true },
);
const paymentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    cardId: { type: ObjectId, ref: "Card", required: true },
    amount: { type: Decimal128, required: true, set: toMoney },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    currency: currencyField,
  },
  { timestamps: true },
);
const transferSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    fromAccountId: { type: ObjectId, ref: "Card", required: true },
    toAccountId: { type: ObjectId, ref: "Card" },
    destinationType: { type: String, enum: ["internal", "external"], default: "internal" },
    externalName: String,
    externalBankName: String,
    externalAccountNumber: String,
    externalIfscCode: String,
    externalUpiId: String,
    amount: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0.01) },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const beneficiarySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String,
    note: String,
  },
  { timestamps: true },
);
const billSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["mobile", "internet", "postpaid", "electricity", "water", "gas", "other"],
      default: "other",
    },
    provider: String,
    amount: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0) },
    dueDate: { type: Date, required: true, set: toUTCDate, validate: validDate },
    paid: { type: Boolean, default: false },
    paidDate: { type: Date, set: toUTCDate, validate: validDate },
    paymentType: { type: String, enum: ["card", "bank", "cash", "upi", "other"] },
    paymentAccountId: { type: ObjectId, ref: "Card" },
    paymentReference: String,
    note: String,
    isSubscription: { type: Boolean, default: false },
    subscriptionFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"] },
    currency: currencyField,
  },
  { timestamps: true },
);
const loanRepaymentSchema = withIdTransform(
  new Schema({
    paymentNumber: { type: Number, required: true },
    paid: { type: Boolean, required: true },
    paidDate: { type: Date, set: toUTCDate, validate: validDate },
    note: String,
    paymentType: { type: String, enum: ["card", "bank", "cash", "upi", "other"] },
    paymentSource: { type: ObjectId, ref: "Card" },
  }),
);
const loanSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    lender: { type: String, required: true },
    principal: { type: Decimal128, required: true, set: toMoney },
    annualInterestRate: { type: Number, required: true },
    termMonths: { type: Number, required: true },
    startDate: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    repayments: {
      type: [loanRepaymentSchema],
      default: [],
    },
    currency: currencyField,
  },
  { timestamps: true },
);
const incomeSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    source: { type: String, required: true },
    category: {
      type: String,
      enum: ["salary", "freelance", "business", "interest", "dividend", "refund", "gift", "other"],
      default: "other",
    },
    accountId: { type: ObjectId, ref: "Card" },
    amount: { type: Decimal128, required: true, set: toMoney },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    recurringFrequency: { type: String, enum: ["monthly", "weekly", "yearly"] },
    recurringInterval: Number,
    recurringEndDate: { type: Date, set: toUTCDate, validate: validDate },
    recurringTemplateId: { type: ObjectId, ref: "Income" },
    isRecurringInstance: Boolean,
    currency: currencyField,
  },
  { timestamps: true },
);
const savingsGoalSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    targetAmount: { type: Decimal128, required: true, set: toMoney },
    targetDate: { type: Date, required: true, set: toUTCDate, validate: validDate },
    currentAmount: { type: Decimal128, required: true, set: toMoney },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const savingsContributionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    goalId: { type: ObjectId, ref: "SavingsGoal", required: true },
    amount: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0.01) },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    recurringFrequency: { type: String, enum: ["weekly", "monthly", "yearly"] },
    recurringInterval: { type: Number, min: 1 },
    recurringEndDate: { type: Date, set: toUTCDate, validate: validDate },
    recurringTemplateId: { type: ObjectId, ref: "SavingsContribution" },
    isRecurringInstance: Boolean,
    currency: currencyField,
  },
  { timestamps: true },
);
const rewardPointsSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    cardId: { type: ObjectId, ref: "Card", required: true },
    type: { type: String, enum: ["earned", "redeemed", "expired"], required: true },
    points: { type: Number, required: true },
    valuePerPoint: Number,
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    expiryDate: { type: Date, set: toUTCDate, validate: validDate },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const investmentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    platform: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["equity", "mutual-fund", "etf", "bond", "retirement", "other"],
      required: true,
    },
    subtype: {
      type: String,
      enum: ["equity", "debt", "index", "hybrid", "solution-oriented", "other", "pf", "vpf", "nps"],
    },
    classification: {
      type: String,
      enum: ["large-cap", "mid-cap", "small-cap", "flexi-cap", "multi-cap", "other"],
    },
    quantity: { type: Number, required: true, min: 0 },
    investedAmount: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0) },
    currentValue: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0) },
    purchaseDate: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const investmentTransactionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    investmentId: { type: ObjectId, ref: "Investment", required: true },
    type: { type: String, enum: ["buy", "sell", "dividend", "fee"], required: true },
    quantity: { type: Number, min: 0 },
    amount: { type: Decimal128, required: true, set: toMoney, validate: decimalMin(0) },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const premiumPaymentSchema = withIdTransform(
  new Schema({
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    amount: { type: Decimal128, required: true, set: toMoney },
    paymentType: {
      type: String,
      enum: ["card", "cash", "upi", "bank", "other"],
      default: "other",
    },
    paymentSource: { type: ObjectId, ref: "Card" },
    note: String,
  }),
);
const insurancePolicySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    policyName: { type: String, required: true },
    type: {
      type: String,
      enum: ["health", "life", "term", "vehicle", "home", "other"],
      default: "other",
    },
    provider: { type: String, required: true },
    policyNumber: String,
    sumAssured: { type: Decimal128, required: true, set: toMoney },
    premiumAmount: { type: Decimal128, required: true, set: toMoney },
    premiumFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "half-yearly", "yearly"],
      default: "yearly",
    },
    startDate: { type: Date, required: true, set: toUTCDate, validate: validDate },
    endDate: { type: Date, set: toUTCDate, validate: validDate },
    note: String,
    premiumPayments: {
      type: [premiumPaymentSchema],
      default: [],
    },
    currency: currencyField,
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
    // Optional (sparse unique) so existing users aren't broken; enables future password-reset/MFA flows without a data migration.
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
  },
  { timestamps: true },
);
const budgetRuleSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["category", "card"], required: true },
    targetId: { type: ObjectId, required: true },
    thresholdAmount: { type: Decimal128, required: true, set: toMoney },
    period: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
    enabled: { type: Boolean, default: true },
    note: String,
    currency: currencyField,
  },
  { timestamps: true },
);
const autoCategorizeRuleSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    keyword: { type: String, required: true },
    categoryId: { type: ObjectId, ref: "Category", required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);
const netWorthSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, set: toUTCDate, validate: validDate },
    assets: { type: Decimal128, required: true, set: toMoney },
    liabilities: { type: Decimal128, required: true, set: toMoney },
    netWorth: { type: Decimal128, required: true, set: toMoney },
    currency: currencyField,
  },
  { timestamps: true },
);
// A household lets its owner share full read/write access to their entire dataset with other
// users, invited by email. Members are looked up by the auth middleware in routes.js, which
// re-points an active member's effective userId at the owner - so no other route needs to change.
const householdMemberSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    userId: { type: String },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    // select:false - the raw token is only ever returned once, directly by the invite endpoint's
    // response, never via a queried Household document (would let anyone reading the household
    // hijack another pending member's invite).
    inviteToken: { type: String, select: false },
    invitedAt: { type: Date, default: () => new Date() },
    joinedAt: { type: Date },
  },
  { _id: false },
);
const householdSchema = new Schema(
  {
    ownerUserId: { type: String, required: true, unique: true, index: true },
    members: { type: [householdMemberSchema], default: [] },
  },
  { timestamps: true },
);
export const User = model("User", withIdTransform(userSchema));
export const Card = model("Card", withIdTransform(cardSchema));
export const Category = model("Category", withIdTransform(categorySchema));
export const Expense = model("Expense", withIdTransform(expenseSchema));
export const Payment = model("Payment", withIdTransform(paymentSchema));
export const Transfer = model("Transfer", withIdTransform(transferSchema));
export const Beneficiary = model("Beneficiary", withIdTransform(beneficiarySchema));
export const Bill = model("Bill", withIdTransform(billSchema));
export const Loan = model("Loan", withIdTransform(loanSchema));
export const SavingsGoal = model("SavingsGoal", withIdTransform(savingsGoalSchema));
export const SavingsContribution = model(
  "SavingsContribution",
  withIdTransform(savingsContributionSchema),
);
export const Income = model("Income", withIdTransform(incomeSchema));
export const RewardPoints = model("RewardPoints", withIdTransform(rewardPointsSchema));
export const Investment = model("Investment", withIdTransform(investmentSchema));
export const InvestmentTransaction = model(
  "InvestmentTransaction",
  withIdTransform(investmentTransactionSchema),
);
export const InsurancePolicy = model("InsurancePolicy", withIdTransform(insurancePolicySchema));
export const BudgetRule = model("BudgetRule", withIdTransform(budgetRuleSchema));
export const AutoCategorizeRule = model(
  "AutoCategorizeRule",
  withIdTransform(autoCategorizeRuleSchema),
);
export const NetWorthSnapshot = model("NetWorthSnapshot", withIdTransform(netWorthSnapshotSchema));
export const Household = model("Household", withIdTransform(householdSchema));
